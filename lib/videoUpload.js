const ALLOWED_VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov"]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

/** Maximum videos per property in the add/edit gallery. */
export const MAX_PROPERTY_VIDEOS = 3;

/** Per-file size cap for property videos (100 MB). */
export const MAX_PROPERTY_VIDEO_BYTES = 100 * 1024 * 1024;

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
  return "Please upload one video in MP4, WebM, or MOV format.";
}

export function videosFormatErrorMessage() {
  return "Please upload videos in MP4, WebM, or MOV format.";
}

export function videoLimitErrorMessage() {
  return "Maximum 3 videos allowed. Remove an existing video before adding another.";
}

export function videoSizeErrorMessage() {
  return "Each property video must be 100 MB or smaller.";
}

export function videoCorruptErrorMessage() {
  return "One or more videos could not be read. Please upload a valid MP4, WebM, or MOV file.";
}

export function videoProcessErrorMessage() {
  return "Could not process the property video. Please try a different file.";
}

export function videoFfmpegMissingErrorMessage() {
  return "Video processing is unavailable on this server (FFmpeg is not installed). Please contact support.";
}
