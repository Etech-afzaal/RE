import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import { validateAndProcessVideoBuffer } from "@/lib/serverVideoProcess";
import {
  isPropertyLockedForAgent,
  PROPERTY_LOCKED_MESSAGE,
} from "@/lib/status";
import { resolvePublicUploadPath } from "@/lib/uploadPath";
import {
  getVideoExtension,
  isVideoFile,
  MAX_PROPERTY_VIDEO_BYTES,
  videoFormatErrorMessage,
  videoSizeErrorMessage,
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

async function getOwnedProperty(propertyId, agentId) {
  const rows = await query(
    "SELECT id, status FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  return rows[0] || null;
}

function videoLocalPath(videoUrl) {
  return resolvePublicUploadPath(videoUrl);
}

async function removeLocalUpload(publicUrl) {
  const localPath = videoLocalPath(publicUrl);
  if (localPath) await rm(localPath, { force: true }).catch(() => {});
}

/** Remove gallery rows + files for this property. */
async function clearPropertyVideos(propertyId) {
  await ensurePropertyVideosTable();
  const rows = await query(
    "SELECT id, video_url, thumbnail_url FROM property_videos WHERE property_id = ?",
    [propertyId],
  );
  for (const video of rows) {
    await removeLocalUpload(video.video_url);
    await removeLocalUpload(video.thumbnail_url);
  }
  if (rows.length > 0) {
    await query("DELETE FROM property_videos WHERE property_id = ?", [
      propertyId,
    ]);
  }
}

export async function POST(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const agentId = Number(session.user.agent_id || session.user.id);
  const property = await getOwnedProperty(propertyId, agentId);
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
  if (isPropertyLockedForAgent(property.status)) {
    return NextResponse.json(
      { error: PROPERTY_LOCKED_MESSAGE },
      { status: 409 },
    );
  }

  const formData = await req.formData();
  const files = formData.getAll("video").filter((value) => value instanceof File);
  if (files.length !== 1 || !isVideoFile(files[0])) {
    return NextResponse.json({ error: videoFormatErrorMessage() }, { status: 400 });
  }

  const file = files[0];
  if (file.size > MAX_PROPERTY_VIDEO_BYTES) {
    return NextResponse.json({ error: videoSizeErrorMessage() }, { status: 400 });
  }

  const extension = getVideoExtension(file);
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "videos",
    String(propertyId),
  );
  const id = nanoid(10);
  const filename = `${id}.mp4`;
  const thumbFilename = `${id}_thumbnail.webp`;
  const publicUrl = `/uploads/videos/${propertyId}/${filename}`;
  const thumbnailUrl = `/uploads/videos/${propertyId}/${thumbFilename}`;

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const processed = await validateAndProcessVideoBuffer(inputBuffer, {
      extension,
    });
    if (!processed.ok) {
      return NextResponse.json({ error: processed.error }, { status: 400 });
    }

    // Replace walkthrough: clear gallery, then insert the new featured video.
    await clearPropertyVideos(propertyId);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), processed.videoBuffer);
    await writeFile(
      path.join(uploadDir, thumbFilename),
      processed.thumbnailBuffer,
    );

    await query(
      `INSERT INTO property_videos
        (property_id, video_url, thumbnail_url, category, is_featured, display_order)
       VALUES (?, ?, ?, NULL, TRUE, 0)`,
      [propertyId, publicUrl, thumbnailUrl],
    );
  } catch (err) {
    await removeLocalUpload(publicUrl);
    await removeLocalUpload(thumbnailUrl);
    console.error("Failed to save property video:", err);
    return NextResponse.json(
      { error: "Could not upload the property video." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    videoUrl: publicUrl,
    thumbnailUrl,
  });
}

export async function DELETE(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const agentId = Number(session.user.agent_id || session.user.id);
  const property = await getOwnedProperty(propertyId, agentId);
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
  if (isPropertyLockedForAgent(property.status)) {
    return NextResponse.json(
      { error: PROPERTY_LOCKED_MESSAGE },
      { status: 409 },
    );
  }

  try {
    await clearPropertyVideos(propertyId);
  } catch (err) {
    console.error("Failed to remove property video:", err);
    return NextResponse.json(
      { error: "Could not remove the property video." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
