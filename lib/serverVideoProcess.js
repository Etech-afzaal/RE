/**
 * Server-side video integrity checks, FFmpeg compression, and thumbnail generation.
 * Used after MIME/extension validation on property video upload routes.
 */

import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import {
  videoCorruptErrorMessage,
  videoFfmpegMissingErrorMessage,
  videoProcessErrorMessage,
} from "@/lib/videoUpload";

const execFileAsync = promisify(execFile);

/** H.264 quality (26–28 range; lower = larger/better). */
export const VIDEO_CRF = 27;

/** Cap longest edge at 1080p; never upscale. */
export const MAX_VIDEO_HEIGHT = 1080;
export const MAX_VIDEO_WIDTH = 1920;

const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000;
const FFPROBE_TIMEOUT_MS = 60 * 1000;

function ffmpegBin() {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

function ffprobeBin() {
  return process.env.FFPROBE_PATH || "ffprobe";
}

/**
 * Probe a video file for stream metadata.
 * @param {string} filePath
 * @returns {Promise<object>}
 */
async function probeVideo(filePath) {
  const { stdout } = await execFileAsync(
    ffprobeBin(),
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration,format_name,size:stream=codec_type,codec_name,width,height",
      "-of",
      "json",
      filePath,
    ],
    { timeout: FFPROBE_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
  );
  return JSON.parse(stdout || "{}");
}

/**
 * Validate that a buffer is a real video with at least one video stream.
 *
 * @param {Buffer} buffer
 * @param {{ extension?: string }} [options]
 * @returns {Promise<{ ok: true, metadata: object } | { ok: false, error: string }>}
 */
export async function validateVideoBuffer(buffer, options = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: videoCorruptErrorMessage() };
  }

  const ext = String(options.extension || "mp4").replace(/^\./, "") || "mp4";
  let tempDir = null;

  try {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "re-video-validate-"));
    const inputPath = path.join(tempDir, `input.${ext}`);
    await writeFile(inputPath, buffer);

    const probe = await probeVideo(inputPath);
    const streams = Array.isArray(probe.streams) ? probe.streams : [];
    const videoStream = streams.find((stream) => stream.codec_type === "video");
    const audioStream = streams.find((stream) => stream.codec_type === "audio");

    if (!videoStream) {
      return { ok: false, error: videoCorruptErrorMessage() };
    }

    const width = Number(videoStream.width) || 0;
    const height = Number(videoStream.height) || 0;
    if (width <= 0 || height <= 0) {
      return { ok: false, error: videoCorruptErrorMessage() };
    }

    return {
      ok: true,
      metadata: {
        width,
        height,
        duration: Number(probe.format?.duration) || null,
        formatName: probe.format?.format_name || null,
        videoCodec: videoStream.codec_name || null,
        hasAudio: Boolean(audioStream),
      },
    };
  } catch (err) {
    if (err?.code === "ENOENT") {
      return { ok: false, error: videoFfmpegMissingErrorMessage() };
    }
    return { ok: false, error: videoCorruptErrorMessage() };
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Compress a video to H.264/AAC MP4 and generate a WebP thumbnail.
 *
 * @param {Buffer} buffer
 * @param {{ extension?: string, crf?: number }} [options]
 * @returns {Promise<
 *   | { ok: true, videoBuffer: Buffer, thumbnailBuffer: Buffer, metadata: object }
 *   | { ok: false, error: string }
 * >}
 */
export async function compressVideoAndGenerateThumbnail(buffer, options = {}) {
  const validated = await validateVideoBuffer(buffer, options);
  if (!validated.ok) {
    return validated;
  }

  const ext = String(options.extension || "mp4").replace(/^\./, "") || "mp4";
  const crf = options.crf ?? VIDEO_CRF;
  let tempDir = null;

  try {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "re-video-process-"));
    const inputPath = path.join(tempDir, `input.${ext}`);
    const outputPath = path.join(tempDir, "output.mp4");
    const thumbPath = path.join(tempDir, "thumbnail.webp");

    await writeFile(inputPath, buffer);

    // Scale down to max 1080p, keep aspect ratio, never upscale, even dimensions for H.264.
    const scaleFilter =
      `scale='min(${MAX_VIDEO_WIDTH},iw)':'min(${MAX_VIDEO_HEIGHT},ih)'` +
      `:force_original_aspect_ratio=decrease:force_divisible_by=2`;

    const ffmpegArgs = [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      String(crf),
      "-vf",
      scaleFilter,
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
    ];

    if (validated.metadata.hasAudio) {
      ffmpegArgs.push("-c:a", "aac", "-b:a", "128k", "-ac", "2");
    } else {
      ffmpegArgs.push("-an");
    }

    ffmpegArgs.push(outputPath);

    await execFileAsync(ffmpegBin(), ffmpegArgs, {
      timeout: FFMPEG_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
    });

    // Prefer a frame ~1s in; fall back to the start for very short clips.
    const duration = validated.metadata.duration;
    const seekSeconds =
      Number.isFinite(duration) && duration > 0
        ? Math.min(1, Math.max(0, duration * 0.1))
        : 0;

    try {
      await execFileAsync(
        ffmpegBin(),
        [
          "-y",
          "-ss",
          String(seekSeconds),
          "-i",
          outputPath,
          "-frames:v",
          "1",
          "-vf",
          "scale='min(1280,iw)':-2",
          thumbPath,
        ],
        { timeout: FFPROBE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      );
    } catch {
      await execFileAsync(
        ffmpegBin(),
        [
          "-y",
          "-i",
          outputPath,
          "-frames:v",
          "1",
          "-vf",
          "scale='min(1280,iw)':-2",
          thumbPath,
        ],
        { timeout: FFPROBE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      );
    }

    const videoBuffer = await readFile(outputPath);
    const thumbnailBuffer = await readFile(thumbPath);

    if (!videoBuffer.length || !thumbnailBuffer.length) {
      return { ok: false, error: videoProcessErrorMessage() };
    }

    return {
      ok: true,
      videoBuffer,
      thumbnailBuffer,
      metadata: validated.metadata,
    };
  } catch (err) {
    console.error("Video compression failed:", err?.message || err);
    const missingBinary =
      err?.code === "ENOENT" ||
      /ffmpeg|ffprobe/i.test(String(err?.message || "")) &&
        /not found|ENOENT|spawn/i.test(String(err?.message || ""));
    return {
      ok: false,
      error: missingBinary
        ? videoFfmpegMissingErrorMessage()
        : videoProcessErrorMessage(),
    };
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Validate then compress + thumbnail in one step.
 *
 * @param {Buffer} buffer
 * @param {{ extension?: string, crf?: number }} [options]
 */
export async function validateAndProcessVideoBuffer(buffer, options = {}) {
  return compressVideoAndGenerateThumbnail(buffer, options);
}
