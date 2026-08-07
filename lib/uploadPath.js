import path from "path";

/**
 * Resolve a stored public upload URL to a path under public/uploads only.
 * Returns null when the URL is missing or would escape the uploads root.
 */
export function resolvePublicUploadPath(publicUrl) {
  const relative = String(publicUrl || "").replace(/^\/+/, "");
  if (!relative.startsWith("uploads/")) return null;

  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  const full = path.resolve(process.cwd(), "public", relative);
  const prefix = uploadsRoot.endsWith(path.sep)
    ? uploadsRoot
    : `${uploadsRoot}${path.sep}`;

  if (full !== uploadsRoot && !full.startsWith(prefix)) {
    return null;
  }

  return full;
}
