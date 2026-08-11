import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { companyNameFromAgent } from "@/lib/agentBranding";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";
import {
  MAX_PROPERTY_IMAGES,
  IMAGE_KINDS,
  imageFormatErrorMessage,
  imageLimitErrorMessage,
  imageProcessErrorMessage,
  validateImageUploadFile,
} from "@/lib/imageUpload";
import { normalizeImageCategory } from "@/lib/imageCategories";
import { validateImageBuffer } from "@/lib/serverImageProcess";
import {
  isPropertyLockedForAgent,
  PROPERTY_LOCKED_MESSAGE,
} from "@/lib/status";
import { resolvePublicUploadPath } from "@/lib/uploadPath";
import { applyWatermark } from "@/lib/watermark";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

// NOTE: This saves watermarked files to /public/uploads on local disk.
// That's fine for development, but on most hosts (Vercel, etc.) the filesystem
// is read-only/ephemeral in production — swap this for S3 / R2 / Spaces before
// deploying. The watermark logic itself stays the same either way.

/** Load company branding for the logged-in agent (watermark text source). */
async function getAgentWatermarkText(session) {
  const agentId = Number(session.user.agent_id || session.user.id);
  const rows = await query(
    `SELECT company_name, estate_name, username
     FROM users
     WHERE id = ? AND user_type = 'agent'
     LIMIT 1`,
    [agentId],
  );
  return companyNameFromAgent(rows[0] || session.user);
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
async function getOwnedProperty(propertyId, session) {
  if (!Number.isInteger(propertyId) || propertyId <= 0) return null;
  const agentId = Number(session.user.agent_id || session.user.id);
  const rows = await query(
    "SELECT id, status FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  return rows[0] || null;
}

function lockedResponse() {
  return NextResponse.json(
    { error: PROPERTY_LOCKED_MESSAGE },
    { status: 409 },
  );
}

export async function POST(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const property = await getOwnedProperty(propertyId, session);
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
  if (isPropertyLockedForAgent(property.status)) {
    return lockedResponse();
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

  for (const file of files) {
    if (!(file instanceof File)) {
      return NextResponse.json({ error: imageFormatErrorMessage() }, { status: 400 });
    }
    const validated = validateImageUploadFile(file, IMAGE_KINDS.PROPERTY);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
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

  // Resolve once per upload batch — company/estate name from agent branding.
  const watermarkText = await getAgentWatermarkText(session);

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    String(propertyId),
  );
  await mkdir(uploadDir, { recursive: true });

  const savedUrls = [];

  async function cleanupSavedFiles() {
    await Promise.all(
      savedUrls.map(async (url) => {
        const localPath = resolvePublicUploadPath(url);
        if (localPath) await rm(localPath, { force: true }).catch(() => {});
      }),
    );
  }

  try {
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      // Reject corrupted / unsupported payloads before watermarking.
      const integrity = await validateImageBuffer(inputBuffer);
      if (!integrity.ok) {
        await cleanupSavedFiles();
        return NextResponse.json({ error: integrity.error }, { status: 400 });
      }

      // Watermark once at upload; stored file is the final branded + compressed copy.
      // PUT/metadata edits never re-process images, so duplicates are avoided.
      const watermarked = await applyWatermark(inputBuffer, {
        text: watermarkText,
      });

      const filename = `${nanoid(10)}.webp`;
      await writeFile(path.join(uploadDir, filename), watermarked);

      const publicUrl = `/uploads/${propertyId}/${filename}`;
      savedUrls.push(publicUrl);
    }
  } catch (err) {
    await cleanupSavedFiles();
    console.error("Failed to process property images:", err);
    return NextResponse.json(
      {
        error:
          err?.message?.includes("unsupported") || err?.message?.includes("Input")
            ? imageFormatErrorMessage()
            : imageProcessErrorMessage(),
      },
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

  const agentId = Number(session.user.agent_id || session.user.id);
  const propertyRows = await query(
    "SELECT title FROM properties WHERE id = ? LIMIT 1",
    [propertyId],
  );
  const propertyTitle = propertyRows[0]?.title || `Property #${propertyId}`;
  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.PROPERTY_IMAGES_UPLOADED,
    entityType: AUDIT_ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    description: `${agentName} uploaded ${savedUrls.length} image(s) for "${propertyTitle}"`,
    metadata: {
      property_title: propertyTitle,
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      image_count: savedUrls.length,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true, images: savedUrls });
}

export async function PUT(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const property = await getOwnedProperty(propertyId, session);
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
  if (isPropertyLockedForAgent(property.status)) {
    return lockedResponse();
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
  const property = await getOwnedProperty(propertyId, session);
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
  if (isPropertyLockedForAgent(property.status)) {
    return lockedResponse();
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

    const localPath = resolvePublicUploadPath(image.image_url);
    if (localPath) await rm(localPath, { force: true });
    await query(
      "DELETE FROM property_images WHERE id = ? AND property_id = ?",
      [Number(imageId), propertyId],
    );
  }

  return NextResponse.json({ success: true });
}
