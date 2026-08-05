import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import {
  MAX_PROPERTY_IMAGES,
  imageFormatErrorMessage,
  imageLimitErrorMessage,
  isImageFile,
} from "@/lib/imageUpload";
import { normalizeImageCategory } from "@/lib/imageCategories";
import sharp from "sharp";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

// NOTE: This saves watermarked files to /public/uploads on local disk.
// That's fine for development, but on most hosts (Vercel, etc.) the filesystem
// is read-only/ephemeral in production — swap this for S3 / R2 / Spaces before
// deploying. The watermark logic itself stays the same either way.

function watermarkSvg(text, width, height) {
  const fontSize = Math.max(18, Math.round(width / 22));
  return Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .wm { fill: rgba(255,255,255,0.65); font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; }
      </style>
      <text x="50%" y="95%" text-anchor="middle" class="wm">${text}</text>
    </svg>
  `);
}

async function ensureImageColumns() {
  const titleColumn = await query(
    "SHOW COLUMNS FROM property_images LIKE 'image_title'",
  );
  if (titleColumn.length === 0) {
    await query(
      "ALTER TABLE property_images ADD COLUMN image_title VARCHAR(255) NULL",
    );
  }

  const featuredColumn = await query(
    "SHOW COLUMNS FROM property_images LIKE 'is_featured'",
  );
  if (featuredColumn.length === 0) {
    await query(
      "ALTER TABLE property_images ADD COLUMN is_featured BOOLEAN DEFAULT FALSE",
    );
  }

  const categoryColumn = await query(
    "SHOW COLUMNS FROM property_images LIKE 'category'",
  );
  if (categoryColumn.length === 0) {
    await query(
      "ALTER TABLE property_images ADD COLUMN category VARCHAR(100) NULL",
    );
  } else {
    const type = String(categoryColumn[0]?.Type || "").toLowerCase();
    if (type.includes("varchar(40)")) {
      await query(
        "ALTER TABLE property_images MODIFY COLUMN category VARCHAR(100) NULL",
      );
    }
  }
}

/** Images may only be touched by the agent who owns the listing. */
async function ownsProperty(propertyId, session) {
  if (!Number.isInteger(propertyId) || propertyId <= 0) return false;
  const agentId = Number(session.user.agent_id || session.user.id);
  const rows = await query(
    "SELECT id FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  return rows.length > 0;
}

export async function POST(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const owned = await ownsProperty(propertyId, session);
  if (!owned) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const formData = await req.formData();
  const files = formData.getAll("images");
  const imageTitles = formData
    .getAll("imageTitles")
    .map((title) => String(title || "").trim());
  const imageOrders = formData
    .getAll("imageOrder")
    .map((value) => Number(value));
  const featuredFlags = formData
    .getAll("isFeatured")
    .map((value) => value === "1");
  // Unknown or missing values normalize to null, i.e. "Uncategorized".
  const imageCategories = formData
    .getAll("imageCategories")
    .map((value) => normalizeImageCategory(value));

  if (files.length === 0) {
    return NextResponse.json({ error: "No images provided." }, { status: 400 });
  }

  const invalid = files.find((file) => !(file instanceof File) || !isImageFile(file));
  if (invalid) {
    return NextResponse.json({ error: imageFormatErrorMessage() }, { status: 400 });
  }

  const existing = await query(
    "SELECT COUNT(*) AS total FROM property_images WHERE property_id = ?",
    [propertyId],
  );
  const existingCount = Number(existing[0]?.total || 0);
  if (existingCount + files.length > MAX_PROPERTY_IMAGES) {
    return NextResponse.json({ error: imageLimitErrorMessage() }, { status: 400 });
  }

  await ensureImageColumns();

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    String(propertyId),
  );
  await mkdir(uploadDir, { recursive: true });

  const savedUrls = [];

  try {
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      const image = sharp(inputBuffer, { failOn: "none" });
      const metadata = await image.metadata();
      const width = metadata.width || 1200;
      const height = metadata.height || 800;

      const watermarked = await image
        .rotate()
        .composite([
          {
            input: watermarkSvg("dhalahoreproperties.com", width, height),
            gravity: "southeast",
          },
        ])
        .jpeg({ quality: 85 })
        .toBuffer();

      const filename = `${nanoid(10)}.jpg`;
      await writeFile(path.join(uploadDir, filename), watermarked);

      const publicUrl = `/uploads/${propertyId}/${filename}`;
      savedUrls.push(publicUrl);
    }
  } catch (err) {
    console.error("Failed to process property images:", err);
    return NextResponse.json(
      { error: imageFormatErrorMessage() },
      { status: 400 },
    );
  }

  for (let i = 0; i < savedUrls.length; i++) {
    const title = imageTitles[i] || null;
    const sortOrder = Number.isFinite(imageOrders[i]) ? imageOrders[i] : i;
    const isFeatured = Boolean(featuredFlags[i]);
    const category = imageCategories[i] ?? null;
    await query(
      "INSERT INTO property_images (property_id, image_url, sort_order, image_title, is_featured, category) VALUES (?, ?, ?, ?, ?, ?)",
      [propertyId, savedUrls[i], sortOrder, title, isFeatured, category],
    );
  }

  return NextResponse.json({ success: true, images: savedUrls });
}

export async function PUT(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const owned = await ownsProperty(propertyId, session);
  if (!owned) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates = Array.isArray(body.updates) ? body.updates : [];

  if (updates.length === 0) {
    return NextResponse.json({ success: true });
  }

  await ensureImageColumns();

  const hasFeatured = updates.some((item) => item.isFeatured);
  if (hasFeatured) {
    await query(
      "UPDATE property_images SET is_featured = FALSE WHERE property_id = ?",
      [propertyId],
    );
  }

  for (const update of updates) {
    const imageId = Number(update.id);
    if (!imageId) continue;

    const imageRows = await query(
      "SELECT id FROM property_images WHERE id = ? AND property_id = ?",
      [imageId, propertyId],
    );
    if (imageRows.length === 0) continue;

    // Only touch what the caller sent, so older screens that post just a title
    // and featured flag cannot wipe an image's category or position.
    const fields = ["image_title = ?", "is_featured = ?"];
    const values = [update.title || null, Boolean(update.isFeatured)];

    if ("category" in update) {
      fields.push("category = ?");
      values.push(normalizeImageCategory(update.category));
    }
    if ("sortOrder" in update && Number.isFinite(Number(update.sortOrder))) {
      fields.push("sort_order = ?");
      values.push(Number(update.sortOrder));
    }

    await query(
      `UPDATE property_images SET ${fields.join(", ")} WHERE id = ? AND property_id = ?`,
      [...values, imageId, propertyId],
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const owned = await ownsProperty(propertyId, session);
  if (!owned) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const imageIds = Array.isArray(body.imageIds) ? body.imageIds : [];

  if (imageIds.length === 0) {
    return NextResponse.json({ success: true });
  }

  await ensureImageColumns();

  for (const imageId of imageIds) {
    const imageRows = await query(
      "SELECT id, image_url FROM property_images WHERE id = ? AND property_id = ?",
      [Number(imageId), propertyId],
    );
    const image = imageRows[0];
    if (!image) continue;

    const localPath = path.join(
      process.cwd(),
      "public",
      image.image_url.replace(/^\/+/, ""),
    );
    await rm(localPath, { force: true });
    await query(
      "DELETE FROM property_images WHERE id = ? AND property_id = ?",
      [Number(imageId), propertyId],
    );
  }

  return NextResponse.json({ success: true });
}
