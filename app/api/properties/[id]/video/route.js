import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import {
  getVideoExtension,
  isVideoFile,
  videoFormatErrorMessage,
} from "@/lib/videoUpload";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

async function getOwnedProperty(propertyId, agentId) {
  const rows = await query(
    "SELECT id, video_url FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  return rows[0] || null;
}

function videoLocalPath(videoUrl) {
  return path.join(process.cwd(), "public", String(videoUrl).replace(/^\/+/, ""));
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

  const formData = await req.formData();
  const files = formData.getAll("video").filter((value) => value instanceof File);
  if (files.length !== 1 || !isVideoFile(files[0])) {
    return NextResponse.json({ error: videoFormatErrorMessage() }, { status: 400 });
  }

  const file = files[0];
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
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
    await query("UPDATE properties SET video_url = ? WHERE id = ?", [
      publicUrl,
      propertyId,
    ]);
    if (property.video_url && property.video_url !== publicUrl) {
      await rm(videoLocalPath(property.video_url), { force: true });
    }
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

  if (property.video_url) {
    await rm(videoLocalPath(property.video_url), { force: true });
  }
  await query("UPDATE properties SET video_url = NULL WHERE id = ?", [propertyId]);

  return NextResponse.json({ success: true });
}
