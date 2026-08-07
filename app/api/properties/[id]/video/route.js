import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
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
      category VARCHAR(100) NULL,
      is_featured BOOLEAN DEFAULT FALSE,
      display_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )
  `);
}

async function getOwnedProperty(propertyId, agentId) {
  const rows = await query(
    "SELECT id, status, video_url FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  return rows[0] || null;
}

function videoLocalPath(videoUrl) {
  return resolvePublicUploadPath(videoUrl);
}

/** Remove gallery rows + files, then clear legacy video_url. */
async function clearPropertyVideos(propertyId) {
  await ensurePropertyVideosTable();
  const rows = await query(
    "SELECT id, video_url FROM property_videos WHERE property_id = ?",
    [propertyId],
  );
  for (const video of rows) {
    const localPath = videoLocalPath(video.video_url);
    if (localPath) await rm(localPath, { force: true });
  }
  if (rows.length > 0) {
    await query("DELETE FROM property_videos WHERE property_id = ?", [
      propertyId,
    ]);
  }
  await query("UPDATE properties SET video_url = NULL WHERE id = ?", [
    propertyId,
  ]);
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
  const filename = `${nanoid(10)}.${extension}`;
  const publicUrl = `/uploads/videos/${propertyId}/${filename}`;

  try {
    // Keep property_videos in sync so public walkthroughs reflect this replace.
    await clearPropertyVideos(propertyId);
    if (property.video_url) {
      const legacyPath = videoLocalPath(property.video_url);
      if (legacyPath) await rm(legacyPath, { force: true });
    }

    await mkdir(uploadDir, { recursive: true });
    await writeFile(
      path.join(uploadDir, filename),
      Buffer.from(await file.arrayBuffer()),
    );

    await query(
      `INSERT INTO property_videos
        (property_id, video_url, category, is_featured, display_order)
       VALUES (?, ?, NULL, TRUE, 0)`,
      [propertyId, publicUrl],
    );
    await query("UPDATE properties SET video_url = ? WHERE id = ?", [
      publicUrl,
      propertyId,
    ]);
  } catch (err) {
    await rm(path.join(uploadDir, filename), { force: true }).catch(() => {});
    console.error("Failed to save property video:", err);
    return NextResponse.json(
      { error: "Could not upload the property video." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, videoUrl: publicUrl });
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
    if (property.video_url) {
      const legacyPath = videoLocalPath(property.video_url);
      if (legacyPath) await rm(legacyPath, { force: true });
    }
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
