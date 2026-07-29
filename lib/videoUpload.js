const ALLOWED_VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "ogg"]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
]);

export function getVideoExtension(file) {
  const name = String(file?.name || "");
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
}

export function isVideoFile(file) {
  if (!(file instanceof File) && !(file && typeof file.arrayBuffer === "function")) {
    return false;
  }

  const extension = getVideoExtension(file);
  const mime = String(file.type || "").trim().toLowerCase();
  return ALLOWED_VIDEO_EXTENSIONS.has(extension) &&
    (!mime || ALLOWED_VIDEO_TYPES.has(mime));
}

export function videoFormatErrorMessage() {
  return "Please upload one video in MP4, WebM, MOV, or OGG format.";
}
