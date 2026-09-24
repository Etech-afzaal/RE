const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const VIDEO_SOURCE_UPLOAD = "UPLOAD";
export const VIDEO_SOURCE_YOUTUBE = "YOUTUBE";

export function extractYouTubeVideoId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  if (hostname !== "youtube.com" && hostname !== "m.youtube.com") return null;

  let id = "";
  if (url.pathname === "/watch") {
    id = url.searchParams.get("v") || "";
  } else if (url.pathname.startsWith("/embed/")) {
    id = url.pathname.slice("/embed/".length).split("/")[0];
  } else if (url.pathname.startsWith("/shorts/")) {
    id = url.pathname.slice("/shorts/".length).split("/")[0];
  }

  return YOUTUBE_ID_PATTERN.test(id) ? id : null;
}

export function parseYouTubeUrl(value) {
  const videoId = extractYouTubeVideoId(value);
  if (!videoId) {
    return {
      ok: false,
      error: "Please enter a valid YouTube video URL.",
    };
  }
  return {
    ok: true,
    videoId,
    thumbnailUrl: youtubeThumbnailUrl(videoId),
  };
}

export function youtubeThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg`;
}

export function youtubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
}
