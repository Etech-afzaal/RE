import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";
import { normalizeImageCategory } from "@/lib/imageCategories";
import { validateAndProcessVideoBuffer } from "@/lib/serverVideoProcess";
import {
  isPropertyLockedForAgent,
  PROPERTY_LOCKED_MESSAGE,
} from "@/lib/status";
import { resolvePublicUploadPath } from "@/lib/uploadPath";
import {
  MAX_PROPERTY_VIDEOS,
  MAX_PROPERTY_VIDEO_BYTES,
  getVideoExtension,
  isVideoFile,
  videoLimitErrorMessage,
  videoSizeErrorMessage,
  videosFormatErrorMessage,
} from "@/lib/videoUpload";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

async function ensurePropertyVideosTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS property_videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      property_id INT NOT NULL,
      video_url VARCHAR(500) NOT NULL,
      thumbnail_url VARCHAR(500) NULL,
      category VARCHAR(100) NULL,
      is_featured BOOLEAN DEFAULT FALSE,
      display_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )
  `);

  const thumbColumn = await query(
    "SHOW COLUMNS FROM property_videos LIKE 'thumbnail_url'",
  );
  if (thumbColumn.length === 0) {
    await query(
      "ALTER TABLE property_videos ADD COLUMN thumbnail_url VARCHAR(500) NULL AFTER video_url",
    );
  }
}

/** Videos may only be touched by the agent who owns the listing. */
async function getOwnedProperty(propertyId, session) {
  if (!Number.isInteger(propertyId) || propertyId <= 0) return null;
  const agentId = Number(session.user.agent_id || session.user.id);
  const rows = await query(
    "SELECT id, status FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  return rows[0] || null;
}

function videoLocalPath(videoUrl) {
  return resolvePublicUploadPath(videoUrl);
}

function lockedResponse() {
  return NextResponse.json(
    { error: PROPERTY_LOCKED_MESSAGE },
    { status: 409 },
  );
}

async function removeLocalUpload(publicUrl) {
  const localPath = videoLocalPath(publicUrl);
  if (localPath) await rm(localPath, { force: true }).catch(() => {});
}

/** Remove files and DB rows for videos already inserted in a failed batch. */
async function rollbackSavedVideos(propertyId, saved) {
  if (!saved.length) return;
  const urls = saved.map((item) => item.videoUrl);
  for (const item of saved) {
    await removeLocalUpload(item.videoUrl);
    await removeLocalUpload(item.thumbnailUrl);
  }
  await query(
    `DELETE FROM property_videos
     WHERE property_id = ? AND video_url IN (${urls.map(() => "?").join(", ")})`,
    [propertyId, ...urls],
  ).catch(() => {});
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

  await ensurePropertyVideosTable();

  const formData = await req.formData();
  const files = formData.getAll("videos");
  const videoOrders = formData
    .getAll("videoOrder")
    .map((value) => Number(value));
  const featuredFlags = formData
    .getAll("isFeatured")
    .map((value) => value === "1");
  const videoCategories = formData
    .getAll("videoCategories")
    .map((value) => normalizeImageCategory(value));

  if (files.length === 0) {
    return NextResponse.json({ error: "No videos provided." }, { status: 400 });
  }

  const invalid = files.find(
    (file) => !(file instanceof File) || !isVideoFile(file),
  );
  if (invalid) {
    return NextResponse.json(
      { error: videosFormatErrorMessage() },
      { status: 400 },
    );
  }

  const oversized = files.find(
    (file) => file instanceof File && file.size > MAX_PROPERTY_VIDEO_BYTES,
  );
  if (oversized) {
    return NextResponse.json({ error: videoSizeErrorMessage() }, { status: 400 });
  }

  const existing = await query(
    "SELECT COUNT(*) AS total FROM property_videos WHERE property_id = ?",
    [propertyId],
  );
  const existingCount = Number(existing[0]?.total || 0);
  if (existingCount + files.length > MAX_PROPERTY_VIDEOS) {
    return NextResponse.json({ error: videoLimitErrorMessage() }, { status: 400 });
  }

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "videos",
    String(propertyId),
  );
  await mkdir(uploadDir, { recursive: true });

  const saved = [];

  try {
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const extension = getVideoExtension(file);
      const inputBuffer = Buffer.from(await file.arrayBuffer());

      const processed = await validateAndProcessVideoBuffer(inputBuffer, {
        extension,
      });
      if (!processed.ok) {
        await rollbackSavedVideos(propertyId, saved);
        return NextResponse.json({ error: processed.error }, { status: 400 });
      }

      const id = nanoid(10);
      const filename = `${id}.mp4`;
      const thumbFilename = `${id}_thumbnail.webp`;
      const publicUrl = `/uploads/videos/${propertyId}/${filename}`;
      const thumbnailUrl = `/uploads/videos/${propertyId}/${thumbFilename}`;

      await writeFile(path.join(uploadDir, filename), processed.videoBuffer);
      await writeFile(
        path.join(uploadDir, thumbFilename),
        processed.thumbnailBuffer,
      );

      const displayOrder = Number.isFinite(videoOrders[i]) ? videoOrders[i] : i;
      const isFeatured = Boolean(featuredFlags[i]);
      const category = videoCategories[i] ?? null;

      await query(
        `INSERT INTO property_videos
          (property_id, video_url, thumbnail_url, category, is_featured, display_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [propertyId, publicUrl, thumbnailUrl, category, isFeatured, displayOrder],
      );

      saved.push({
        videoUrl: publicUrl,
        thumbnailUrl,
        category,
        isFeatured,
        displayOrder,
      });
    }

    // Exactly one featured video per property after this upload batch.
    if (saved.some((item) => item.isFeatured)) {
      await query(
        "UPDATE property_videos SET is_featured = FALSE WHERE property_id = ?",
        [propertyId],
      );
      const featuredUrl =
        saved.find((item) => item.isFeatured)?.videoUrl || saved[0].videoUrl;
      await query(
        `UPDATE property_videos SET is_featured = TRUE
         WHERE property_id = ? AND video_url = ?`,
        [propertyId, featuredUrl],
      );
    } else if (existingCount === 0 && saved.length > 0) {
      await query(
        `UPDATE property_videos SET is_featured = TRUE
         WHERE property_id = ? AND video_url = ?`,
        [propertyId, saved[0].videoUrl],
      );
    }

  } catch (err) {
    await rollbackSavedVideos(propertyId, saved);
    console.error("Failed to save property videos:", err);
    return NextResponse.json(
      { error: "Could not upload the property videos." },
      { status: 500 },
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
    action: AUDIT_ACTIONS.PROPERTY_VIDEO_UPLOADED,
    entityType: AUDIT_ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    description: `${agentName} uploaded ${saved.length} video(s) for "${propertyTitle}"`,
    metadata: {
      property_title: propertyTitle,
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      video_count: saved.length,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({
    success: true,
    videos: saved.map((item) => item.videoUrl),
    thumbnails: saved.map((item) => item.thumbnailUrl),
  });
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

  await ensurePropertyVideosTable();

  const body = await req.json().catch(() => ({}));
  const clearAll = Boolean(body.clearAll);
  const videoIds = Array.isArray(body.videoIds) ? body.videoIds : [];

  const rows = clearAll
    ? await query(
        "SELECT id, video_url, thumbnail_url, is_featured FROM property_videos WHERE property_id = ?",
        [propertyId],
      )
    : (
        await Promise.all(
          videoIds.map(async (videoId) => {
            const found = await query(
              "SELECT id, video_url, thumbnail_url, is_featured FROM property_videos WHERE id = ? AND property_id = ?",
              [Number(videoId), propertyId],
            );
            return found[0] || null;
          }),
        )
      ).filter(Boolean);

  for (const video of rows) {
    await removeLocalUpload(video.video_url);
    await removeLocalUpload(video.thumbnail_url);
    await query(
      "DELETE FROM property_videos WHERE id = ? AND property_id = ?",
      [video.id, propertyId],
    );
  }

  const remaining = await query(
    `SELECT id FROM property_videos
     WHERE property_id = ?
     ORDER BY display_order ASC, id ASC`,
    [propertyId],
  );
  if (remaining.length > 0) {
    const hasFeatured = await query(
      "SELECT id FROM property_videos WHERE property_id = ? AND is_featured = TRUE LIMIT 1",
      [propertyId],
    );
    if (hasFeatured.length === 0) {
      await query(
        "UPDATE property_videos SET is_featured = TRUE WHERE id = ?",
        [remaining[0].id],
      );
    }
  }

  return NextResponse.json({ success: true });
}
