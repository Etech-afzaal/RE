import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdById, setAdImage } from "@/lib/ads/queries";
import sharp from "sharp";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

// Ad creatives are stored like property images (local /public/uploads) but
// without a watermark. Any image is accepted and fitted to the exact size of
// the ad's format:
//   fit=cover   (default) fill the size, smart-cropping to the busiest area
//   fit=contain keep the whole image, filling the spare space with a blurred
//               copy of it
// Moving to S3/R2 later only changes where the file is written.

const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIDE = 20; // anything smaller isn't a usable picture
const FITS = ["cover", "contain"];

// Resizes the upload to exactly width×height using the chosen fit.
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

async function removeStoredImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/ads/")) return;
  const localPath = path.join(process.cwd(), "public", imageUrl.replace(/^\/+/, ""));
  await rm(localPath, { force: true });
}

export async function POST(req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const ad = await getAdById(params.id);
  if (!ad) return NextResponse.json({ error: "Ad not found." }, { status: 404 });
  if (ad.status === "archived") {
    return NextResponse.json({ error: "Archived ads are read-only." }, { status: 409 });
  }

  const formData = await req.formData();
  const file = formData.get("image");
  const fit = FITS.includes(formData.get("fit")) ? formData.get("fit") : "cover";
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
  }

  const width = ad.format_width;
  const height = ad.format_height;
  const input = Buffer.from(await file.arrayBuffer());

  let metadata;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    return NextResponse.json({ error: "That file is not a readable image." }, { status: 400 });
  }

  if (!metadata.width || !metadata.height || metadata.width < MIN_SIDE || metadata.height < MIN_SIDE) {
    return NextResponse.json({ error: "That image is too small to use." }, { status: 400 });
  }

  // Keep a 2x version when the source is big enough, for sharp retina display.
  const scale = metadata.width >= width * 2 && metadata.height >= height * 2 ? 2 : 1;
  let pipeline = await fitImage(input, width * scale, height * scale, fit);
  const extension = metadata.hasAlpha ? "png" : "jpg";
  pipeline = metadata.hasAlpha ? pipeline.png() : pipeline.jpeg({ quality: 85 });
  const output = await pipeline.toBuffer();

  const uploadDir = path.join(process.cwd(), "public", "uploads", "ads", String(ad.id));
  await mkdir(uploadDir, { recursive: true });
  const filename = `${nanoid(10)}.${extension}`;
  await writeFile(path.join(uploadDir, filename), output);

  const imageUrl = `/uploads/ads/${ad.id}/${filename}`;
  await setAdImage(ad.id, imageUrl);
  await removeStoredImage(ad.image_url);

  // Filling the size from a smaller picture means enlarging it.
  const enlarged =
    fit === "cover"
      ? metadata.width < width || metadata.height < height
      : metadata.width < width && metadata.height < height;
  return NextResponse.json({
    success: true,
    ad: await getAdById(ad.id),
    fit,
    source: { width: metadata.width, height: metadata.height },
    warning: enlarged
      ? `The image (${metadata.width}×${metadata.height}) is smaller than ${width}×${height}, so it was enlarged and may look soft. A larger image will look sharper.`
      : null,
  });
}

export async function DELETE(_req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const ad = await getAdById(params.id);
  if (!ad) return NextResponse.json({ error: "Ad not found." }, { status: 404 });

  if (ad.status === "active" && !ad.property_image) {
    return NextResponse.json(
      { error: "This ad is ON and has no property photo to fall back to. Turn it OFF first." },
      { status: 409 },
    );
  }

  await setAdImage(ad.id, null);
  await removeStoredImage(ad.image_url);
  return NextResponse.json({ success: true, ad: await getAdById(ad.id) });
}
