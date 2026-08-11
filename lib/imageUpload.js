/**
 * Shared helpers for agent / property image uploads.
 * Accepts JPG / JPEG / PNG / WEBP. Routes that process an upload also
 * validate its contents with sharp before saving it.
 */

/** Maximum images per property in the add/edit gallery. */
export const MAX_PROPERTY_IMAGES = 40;

/** Per-file size cap for profile images (2 MB). */
export const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;

/** Per-file size cap for company logos (2 MB). */
export const MAX_COMPANY_LOGO_BYTES = 2 * 1024 * 1024;

/** Per-file size cap for property gallery images (5 MB). */
export const MAX_PROPERTY_IMAGE_BYTES = 5 * 1024 * 1024;

export const IMAGE_KINDS = {
  PROFILE: "profile",
  COMPANY_LOGO: "company_logo",
  PROPERTY: "property",
};

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/** Sharp metadata formats that map to our allowlist. */
export const ALLOWED_SHARP_FORMATS = new Set(["jpeg", "png", "webp"]);

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

export function maxBytesForImageKind(kind) {
  switch (kind) {
    case IMAGE_KINDS.PROFILE:
      return MAX_PROFILE_IMAGE_BYTES;
    case IMAGE_KINDS.COMPANY_LOGO:
      return MAX_COMPANY_LOGO_BYTES;
    case IMAGE_KINDS.PROPERTY:
      return MAX_PROPERTY_IMAGE_BYTES;
    default:
      return MAX_PROPERTY_IMAGE_BYTES;
  }
}

export function imageFormatErrorMessage() {
  return "Only JPG, PNG and WEBP images are allowed.";
}

export function imageLimitErrorMessage() {
  return "Maximum 40 images allowed. Remove an image before uploading another.";
}

export function imageSizeErrorMessage() {
  return "Property image size must be 5MB or less.";
}

export function profileImageSizeErrorMessage() {
  return "Profile image size must be 2MB or less.";
}

export function companyLogoSizeErrorMessage() {
  return "Company logo size must be 2MB or less.";
}

export function imageSizeExceededErrorMessage() {
  return "Image size exceeds the allowed limit.";
}

export function imageProcessErrorMessage() {
  return "Unable to process image. Please try another file.";
}

export function imageSizeErrorMessageForKind(kind) {
  switch (kind) {
    case IMAGE_KINDS.PROFILE:
      return profileImageSizeErrorMessage();
    case IMAGE_KINDS.COMPANY_LOGO:
      return companyLogoSizeErrorMessage();
    case IMAGE_KINDS.PROPERTY:
      return imageSizeErrorMessage();
    default:
      return imageSizeExceededErrorMessage();
  }
}

/**
 * Client/server shared pre-check for format + declared size.
 * Does not inspect pixel data — callers should still run sharp validation
 * on the server before saving.
 */
export function validateImageUploadFile(file, kind = IMAGE_KINDS.PROPERTY) {
  if (!(file instanceof File) && !(file && typeof file.arrayBuffer === "function")) {
    return { ok: false, error: imageFormatErrorMessage() };
  }

  if (!isImageFile(file)) {
    return { ok: false, error: imageFormatErrorMessage() };
  }

  if (Number(file.size) > maxBytesForImageKind(kind)) {
    return { ok: false, error: imageSizeErrorMessageForKind(kind) };
  }

  return { ok: true };
}

export {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
};
