/**
 * Upload validators for property images / videos.
 * Size limits match existing product caps (10 MB images, 100 MB videos).
 */

import {
  MAX_PROPERTY_IMAGE_BYTES,
  MAX_PROPERTY_IMAGES,
} from "@/lib/imageUpload";
import {
  MAX_PROPERTY_VIDEO_BYTES,
  MAX_PROPERTY_VIDEOS,
  getVideoExtension,
  isVideoFile,
} from "@/lib/videoUpload";

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function fileExtension(file) {
  const name = String(file?.name || "");
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
}

/**
 * Strict image check: jpg / jpeg / png / webp only (rejects .exe, .php, .js, etc.).
 */
export function isAllowedPropertyImage(file) {
  if (!(file instanceof File) && !(file && typeof file.arrayBuffer === "function")) {
    return false;
  }

  const extension = fileExtension(file);
  const mime = String(file.type || "")
    .trim()
    .toLowerCase();

  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) return false;
  if (mime && !ALLOWED_IMAGE_TYPES.has(mime)) return false;
  return true;
}

export function validatePropertyImageFile(file, { currentCount = 0 } = {}) {
  if (!isAllowedPropertyImage(file)) {
    return {
      ok: false,
      error: "Please upload a JPG, JPEG, PNG, or WEBP image.",
    };
  }

  if (Number(file.size) > MAX_PROPERTY_IMAGE_BYTES) {
    return {
      ok: false,
      error: "Each property image must be 10 MB or smaller.",
    };
  }

  if (currentCount >= MAX_PROPERTY_IMAGES) {
    return {
      ok: false,
      error: "Maximum 40 images allowed. Remove an image before uploading another.",
    };
  }

  return { ok: true };
}

export function validatePropertyVideoFile(file, { currentCount = 0 } = {}) {
  if (!isVideoFile(file)) {
    return {
      ok: false,
      error: "Please upload videos in MP4, WebM, MOV, or OGG format.",
    };
  }

  // Extra extension guard against spoofed mime + dangerous names.
  const extension = getVideoExtension(file);
  if (!["mp4", "webm", "mov", "ogg"].includes(extension)) {
    return {
      ok: false,
      error: "Please upload videos in MP4, WebM, MOV, or OGG format.",
    };
  }

  if (Number(file.size) > MAX_PROPERTY_VIDEO_BYTES) {
    return {
      ok: false,
      error: "Each property video must be 100 MB or smaller.",
    };
  }

  if (currentCount >= MAX_PROPERTY_VIDEOS) {
    return {
      ok: false,
      error: "Maximum 3 videos allowed. Remove an existing video before adding another.",
    };
  }

  return { ok: true };
}

export {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  MAX_PROPERTY_IMAGE_BYTES,
  MAX_PROPERTY_IMAGES,
  MAX_PROPERTY_VIDEO_BYTES,
  MAX_PROPERTY_VIDEOS,
};
