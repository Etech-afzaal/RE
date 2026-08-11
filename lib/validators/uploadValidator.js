/**
 * Upload validators for property images / videos.
 * Size limits match product caps (5 MB images, 100 MB videos).
 */

import {
  MAX_PROPERTY_IMAGE_BYTES,
  MAX_PROPERTY_IMAGES,
  IMAGE_KINDS,
  imageFormatErrorMessage,
  imageLimitErrorMessage,
  imageSizeErrorMessage,
  isImageFile,
  validateImageUploadFile,
} from "@/lib/imageUpload";
import {
  MAX_PROPERTY_VIDEO_BYTES,
  MAX_PROPERTY_VIDEOS,
  getVideoExtension,
  isVideoFile,
} from "@/lib/videoUpload";

/**
 * Strict image check: jpg / jpeg / png / webp only (rejects .exe, .php, .js, etc.).
 */
export function isAllowedPropertyImage(file) {
  return isImageFile(file);
}

export function validatePropertyImageFile(file, { currentCount = 0 } = {}) {
  const base = validateImageUploadFile(file, IMAGE_KINDS.PROPERTY);
  if (!base.ok) {
    return base;
  }

  if (currentCount >= MAX_PROPERTY_IMAGES) {
    return {
      ok: false,
      error: imageLimitErrorMessage(),
    };
  }

  return { ok: true };
}

export function validatePropertyVideoFile(file, { currentCount = 0 } = {}) {
  if (!isVideoFile(file)) {
    return {
      ok: false,
      error: "Please upload videos in MP4, WebM, or MOV format.",
    };
  }

  // Extra extension guard against spoofed mime + dangerous names.
  const extension = getVideoExtension(file);
  if (!["mp4", "webm", "mov"].includes(extension)) {
    return {
      ok: false,
      error: "Please upload videos in MP4, WebM, or MOV format.",
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
  MAX_PROPERTY_IMAGE_BYTES,
  MAX_PROPERTY_IMAGES,
  MAX_PROPERTY_VIDEO_BYTES,
  MAX_PROPERTY_VIDEOS,
  imageFormatErrorMessage,
  imageSizeErrorMessage,
};
