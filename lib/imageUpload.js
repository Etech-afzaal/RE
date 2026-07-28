/**
 * Shared helpers for agent / property image uploads.
 * Accepts any common raster image format; sharp converts to JPEG on save.
 */

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".bmp",
  ".svg",
  ".ico",
  ".jfif",
  ".pjpeg",
  ".pjp",
]);

export function isImageFile(file) {
  if (!(file instanceof File) && !(file && typeof file.arrayBuffer === "function")) {
    return false;
  }

  const mime = String(file.type || "")
    .trim()
    .toLowerCase();
  if (mime.startsWith("image/")) return true;

  // Some browsers send an empty MIME type; fall back to extension.
  const name = String(file.name || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  return IMAGE_EXTENSIONS.has(name.slice(dot));
}

export function imageFormatErrorMessage() {
  return "Please upload a valid image file (JPG, JPEG, PNG, WebP, GIF, AVIF, HEIC, TIFF, BMP, SVG, and similar formats).";
}
