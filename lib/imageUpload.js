/**
 * Shared helpers for agent / property image uploads.
 * Accepts browser-recognized image uploads. Routes that process an upload also
 * validate its contents with sharp before saving it.
 */

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
