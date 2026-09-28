import sharp from "sharp";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { setCreativeImage, setMasterImage } from "@/lib/ads/queries";

// Ad images are stored like property images (local /public/uploads) but
// without a watermark. Moving to S3/R2 later only changes readStored/save.
//
// Each ad has one "main" image (ads.master_image_url) that every size is
// made from, and any size can have its own custom upload instead
// (ad_creatives.source = 'upload'). Every image is fitted to the exact size:
//   fit=cover   (default) fill the size, smart-cropping to the busiest area
//   fit=contain keep the whole image, filling the spare space with a blurred
//               copy of it

export const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIDE = 20; // anything smaller isn't a usable picture
const MASTER_MAX_SIDE = 2400; // plenty for 2x of the largest format
export const FITS = ["cover", "contain"];

export class AdImageError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const parseFit = (value) => (FITS.includes(value) ? value : "cover");

// Reads an uploaded File from form data into { input, metadata }.
export async function readUpload(file) {
  if (!file || typeof file === "string") throw new AdImageError("No image provided.");
  if (file.size > MAX_BYTES) throw new AdImageError("Image must be 5 MB or smaller.");

  const input = Buffer.from(await file.arrayBuffer());
  let metadata;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    throw new AdImageError("That file is not a readable image.");
  }
  if (!metadata.width || !metadata.height || metadata.width < MIN_SIDE || metadata.height < MIN_SIDE) {
    throw new AdImageError("That image is too small to use.");
  }
  // Width/height as displayed (EXIF-rotated photos report them swapped).
  if (metadata.orientation >= 5) {
    metadata = { ...metadata, width: metadata.height, height: metadata.width };
  }
  return { input, metadata };
}

// Resizes to exactly width×height using the chosen fit.
async function fitImage(input, width, height, fit) {
  if (fit === "contain") {
    const background = await sharp(input)
      .rotate()
      .resize(width, height, { fit: "cover" })
      .blur(24)
      .modulate({ brightness: 0.85 })
      .toBuffer();
    const foreground = await sharp(input).rotate().resize(width, height, { fit: "inside" }).toBuffer();
    return sharp(background).composite([{ input: foreground, gravity: "centre" }]);
  }
  return sharp(input)
    .rotate()
    .resize(width, height, { fit: "cover", position: sharp.strategy.attention });
}

async function save(adId, name, buffer) {
  const dir = path.join(process.cwd(), "public", "uploads", "ads", String(adId));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer);
  return `/uploads/ads/${adId}/${name}`;
}

const localPath = (imageUrl) => path.join(process.cwd(), "public", imageUrl.replace(/^\/+/, ""));

export async function removeStoredImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/ads/")) return;
  await rm(localPath(imageUrl), { force: true });
}

async function readStored(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/ads/")) return null;
  try {
    return await readFile(localPath(imageUrl));
  } catch {
    return null;
  }
}

// Filling the size from a smaller picture means enlarging it.
function enlargeWarning(metadata, creative, fit) {
  const { width, height } = creative;
  const enlarged =
    fit === "cover"
      ? metadata.width < width || metadata.height < height
      : metadata.width < width && metadata.height < height;
  return enlarged
    ? `${width}×${height}: the image (${metadata.width}×${metadata.height}) was enlarged to fill this size and may look soft. A larger image will look sharper.`
    : null;
}

// Renders one size from a source image and stores it on the creative.
// Returns a warning string or null.
async function renderSize(ad, creative, { input, metadata }, fit, source) {
  const { width, height } = creative;
  // Keep a 2x version when the source is big enough, for sharp retina display.
  const scale = metadata.width >= width * 2 && metadata.height >= height * 2 ? 2 : 1;
  let pipeline = await fitImage(input, width * scale, height * scale, fit);
  const extension = metadata.hasAlpha ? "png" : "jpg";
  pipeline = metadata.hasAlpha ? pipeline.png() : pipeline.jpeg({ quality: 85 });
  const output = await pipeline.toBuffer();

  const imageUrl = await save(ad.id, `${creative.format_code}-${nanoid(8)}.${extension}`, output);
  await setCreativeImage(ad.id, creative.format_id, { imageUrl, source, fit });
  if (creative.image_url !== imageUrl) await removeStoredImage(creative.image_url);
  return enlargeWarning(metadata, creative, fit);
}

async function loadMaster(ad) {
  const buffer = await readStored(ad.master_image_url);
  if (!buffer) return null;
  const metadata = await sharp(buffer).metadata();
  return { input: buffer, metadata };
}

/**
 * Stores a new main image and makes every size from it, except sizes with a
 * custom upload (unless listed in `replace`).
 *   fits:    { [formatId]: "cover" | "contain" } per-size fit, default: keep
 *   replace: formatIds whose custom upload should be replaced too
 * Returns the warnings.
 */
export async function saveMasterImage(ad, upload, { fits = {}, replace = [] } = {}) {
  // Store the source upright and capped in size, so later sizes can be made from it.
  const { hasAlpha } = upload.metadata;
  let pipeline = sharp(upload.input)
    .rotate()
    .resize(MASTER_MAX_SIDE, MASTER_MAX_SIDE, { fit: "inside", withoutEnlargement: true });
  pipeline = hasAlpha ? pipeline.png() : pipeline.jpeg({ quality: 90 });
  const master = await pipeline.toBuffer();
  const masterUrl = await save(ad.id, `main-${nanoid(8)}.${hasAlpha ? "png" : "jpg"}`, master);
  await setMasterImage(ad.id, masterUrl);
  await removeStoredImage(ad.master_image_url);

  const source = { input: master, metadata: await sharp(master).metadata() };
  const replaceIds = new Set(replace.map(Number));
  const warnings = [];
  for (const creative of ad.creatives) {
    if (creative.source === "upload" && !replaceIds.has(creative.format_id)) continue;
    const fit = FITS.includes(fits[creative.format_id]) ? fits[creative.format_id] : creative.fit;
    warnings.push(await renderSize(ad, creative, source, fit, "generated"));
  }
  return warnings.filter(Boolean);
}

// (Re)makes the given sizes from the stored main image.
export async function generateSizes(ad, formatIds, fits = {}) {
  const wanted = new Set(formatIds.map(Number));
  const creatives = ad.creatives.filter((creative) => wanted.has(creative.format_id));
  if (creatives.length === 0) return [];
  const source = await loadMaster(ad);
  if (!source) throw new AdImageError("Upload a main image first.", 409);

  const warnings = [];
  for (const creative of creatives) {
    const fit = FITS.includes(fits[creative.format_id]) ? fits[creative.format_id] : creative.fit;
    warnings.push(await renderSize(ad, creative, source, fit, "generated"));
  }
  return warnings.filter(Boolean);
}

// A custom image for one size.
export async function saveCustomSize(ad, creative, upload, fit) {
  return renderSize(ad, creative, upload, fit, "upload");
}

// Deletes the main image and every size made from it. Custom uploads stay.
export async function removeMasterImage(ad) {
  for (const creative of ad.creatives) {
    if (creative.source !== "generated") continue;
    await setCreativeImage(ad.id, creative.format_id, { imageUrl: null });
    await removeStoredImage(creative.image_url);
  }
  await setMasterImage(ad.id, null);
  await removeStoredImage(ad.master_image_url);
}

export async function removeSizeImage(ad, creative) {
  await setCreativeImage(ad.id, creative.format_id, { imageUrl: null });
  await removeStoredImage(creative.image_url);
}

// Deletes the files of sizes removed from an ad.
export async function removeCreativeFiles(creatives) {
  for (const creative of creatives) await removeStoredImage(creative.image_url);
}
