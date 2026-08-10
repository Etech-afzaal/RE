/**
 * Shared helpers for agent / property image uploads.
 * Accepts JPG / JPEG / PNG / WEBP. Routes that process an upload also
 * validate its contents with sharp before saving it.
 */

/** Maximum images per property in the add/edit gallery. */
export const MAX_PROPERTY_IMAGES = 40;

/** Per-file size cap for property gallery images (10 MB). */
export const MAX_PROPERTY_IMAGE_BYTES = 10 * 1024 * 1024;

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

export function isImageFile(file) {
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

export function imageFormatErrorMessage() {
  return "Please upload a JPG, JPEG, PNG, or WEBP image.";
}

export function imageLimitErrorMessage() {
  return "Maximum 40 images allowed. Remove an image before uploading another.";
}

export function imageSizeErrorMessage() {
  return "Each property image must be 10 MB or smaller.";
}
