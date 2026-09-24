import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import {
  getVideoExtension,
  isVideoFile,
  MAX_PROPERTY_VIDEO_BYTES,
  videoFfmpegMissingErrorMessage,
  videoFormatErrorMessage,
  videoProcessErrorMessage,
  videoSizeErrorMessage,
} from "@/lib/videoUpload";
import { validateAndProcessVideoBuffer } from "@/lib/serverVideoProcess";
import { resolvePublicUploadPath } from "@/lib/uploadPath";
import { getVideoPostForAgent } from "@/lib/videoPosts";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

async function removeOwnedVideoPostFile(publicUrl, agentId) {
  const expectedPrefix = `/uploads/agents/${agentId}/video-posts/`;
  if (!String(publicUrl || "").startsWith(expectedPrefix)) return;
  const localPath = resolvePublicUploadPath(publicUrl);
  if (localPath) await rm(localPath, { force: true });
}

export async function POST(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const videoPostId = Number(params.id);

  if (!Number.isInteger(videoPostId) || videoPostId <= 0) {
    return NextResponse.json({ error: "Invalid video post." }, { status: 400 });
  }

  const videoPost = await getVideoPostForAgent(agentId, videoPostId);
  if (!videoPost) {
    return NextResponse.json({ error: "Video post not found." }, { status: 404 });
  }

  const formData = await req.formData();
  const video = formData.get("video");

  if (!(video instanceof File) || video.size === 0) {
    return NextResponse.json({ error: "Please select a video file." }, { status: 400 });
  }

  if (!isVideoFile(video)) {
    return NextResponse.json({ error: videoFormatErrorMessage() }, { status: 400 });
  }

  if (video.size > MAX_PROPERTY_VIDEO_BYTES) {
    return NextResponse.json({ error: videoSizeErrorMessage() }, { status: 400 });
  }

  try {
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "agents",
      String(agentId),
      "video-posts",
    );
    await mkdir(uploadDir, { recursive: true });

    const videoBuffer = Buffer.from(await video.arrayBuffer());
    const extension = getVideoExtension(video);
    const processed = await validateAndProcessVideoBuffer(videoBuffer, {
      extension,
    });

    if (!processed.ok) {
      const message = String(processed.error || "").toLowerCase();
      return NextResponse.json(
        {
          error: message.includes("ffmpeg") || message.includes("ffprobe")
            ? videoFfmpegMissingErrorMessage()
            : videoProcessErrorMessage(),
        },
        { status: 500 },
      );
    }

    const id = nanoid(10);
    const videoFilename = `${id}.mp4`;
    const thumbFilename = `${id}_thumbnail.webp`;
    const videoPath = path.join(uploadDir, videoFilename);
    const thumbPath = path.join(uploadDir, thumbFilename);

    await writeFile(videoPath, processed.videoBuffer);
    await writeFile(thumbPath, processed.thumbnailBuffer);

    const videoUrl = `/uploads/agents/${agentId}/video-posts/${videoFilename}`;
    const thumbnailUrl = `/uploads/agents/${agentId}/video-posts/${thumbFilename}`;

    await query(
      "UPDATE video_posts SET video_source = 'UPLOAD', video_url = ?, youtube_video_id = NULL, thumbnail_url = ? WHERE id = ? AND agent_id = ?",
      [videoUrl, thumbnailUrl, videoPostId, agentId],
    );

    // Remove the previous video + thumbnail if they existed.
    if (videoPost.video_url && videoPost.video_url !== videoUrl) {
      await removeOwnedVideoPostFile(videoPost.video_url, agentId);
    }
    if (videoPost.thumbnail_url && videoPost.thumbnail_url !== thumbnailUrl) {
      await removeOwnedVideoPostFile(videoPost.thumbnail_url, agentId);
    }

    revalidatePath("/");

    return NextResponse.json({
      success: true,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
    });
  } catch (err) {
    console.error("Failed to upload video post file:", err);
    const message = String(err?.message || "").toLowerCase();
    return NextResponse.json(
      {
        error: message.includes("ffmpeg") || message.includes("ffprobe")
          ? videoFfmpegMissingErrorMessage()
          : videoProcessErrorMessage(),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const videoPostId = Number(params.id);

  if (!Number.isInteger(videoPostId) || videoPostId <= 0) {
    return NextResponse.json({ error: "Invalid video post." }, { status: 400 });
  }

  const videoPost = await getVideoPostForAgent(agentId, videoPostId);
  if (!videoPost) {
    return NextResponse.json({ error: "Video post not found." }, { status: 404 });
  }

  if (videoPost.video_url) {
    await removeOwnedVideoPostFile(videoPost.video_url, agentId);
  }
  if (videoPost.thumbnail_url) {
    await removeOwnedVideoPostFile(videoPost.thumbnail_url, agentId);
  }

  await query(
    "UPDATE video_posts SET video_source = 'UPLOAD', video_url = NULL, youtube_video_id = NULL, thumbnail_url = NULL WHERE id = ? AND agent_id = ?",
    [videoPostId, agentId],
  );

  return NextResponse.json({ success: true, video_url: null, thumbnail_url: null });
}
