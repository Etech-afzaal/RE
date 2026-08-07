/**
 * Shared helpers for agent / property image uploads.
 * Accepts browser-recognized image uploads. Routes that process an upload also
 * validate its contents with sharp before saving it.
 */

/** Maximum images per property in the add/edit gallery. */
export const MAX_PROPERTY_IMAGES = 40;

/** Per-file size cap for property gallery images (10 MB). */
export const MAX_PROPERTY_IMAGE_BYTES = 10 * 1024 * 1024;

export function isImageFile(file) {
  if (!(file instanceof File) && !(file && typeof file.arrayBuffer === "function")) {
    return false;
  }

  const mime = String(file.type || "")
    .trim()
    .toLowerCase();
  return mime.startsWith("image/");
}

export function imageFormatErrorMessage() {
  return "Please upload a valid image file.";
}

export function imageLimitErrorMessage() {
  return "Maximum 40 images allowed. Remove an image before uploading another.";
}

export function imageSizeErrorMessage() {
  return "Each property image must be 10 MB or smaller.";
}
