/**
 * Public property URL helpers.
 * Format: /re/{agentUsername}/{slugified-title}-{id}
 * Numeric IDs still resolve for older links.
 *
 * Prefer getPropertyUrl(property) everywhere — do not hand-build public paths.
 */

export function slugifyTitle(title) {
  const slug = String(title || "property")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "property";
}

/**
 * Build the public URL path segment: `{slug}-{id}`.
 * Uses `property.slug` when present; otherwise slugifies `property.title`.
 */
export function buildPropertySlug(property) {
  const id = property?.id;
  const stored = String(property?.slug || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  let titleSlug;
  if (stored) {
    // Already a full segment ending in -{id} — keep it.
    if (id != null && new RegExp(`-${id}$`).test(stored)) {
      return stored;
    }
    titleSlug = slugifyTitle(stored.replace(/-\d+$/, "") || stored);
  } else {
    titleSlug = slugifyTitle(property?.title);
  }

  if (id == null) return titleSlug;
  return `${titleSlug}-${id}`;
}

export function agentPublicUsername(agentOrProperty) {
  if (!agentOrProperty) return "";
  return (
    agentOrProperty.username ||
    agentOrProperty.estate_name ||
    ""
  );
}

/**
 * Canonical public property URL.
 *
 * @param {object} property — needs `id` + `title` (or `slug`), and
 *   `username` / `estate_name` unless `agentUsername` is passed.
 * @param {string} [agentUsername] — optional override for the estate handle.
 * @returns {string} e.g. `/re/johar-living/10-marla-house-in-dha-phase-5-40`
 */
export function getPropertyUrl(property, agentUsername) {
  const user = agentUsername || agentPublicUsername(property);
  if (!user || property?.id == null) return "#";
  return `/re/${encodeURIComponent(user)}/${buildPropertySlug(property)}`;
}

/**
 * @deprecated Prefer getPropertyUrl(property). Kept for existing call sites.
 */
export function propertyPublicPath(agentUsername, property) {
  return getPropertyUrl(property, agentUsername);
}

/** @returns {number|null} property id parsed from slug or raw numeric param */
export function parsePropertySlugParam(slugParam) {
  const raw = decodeURIComponent(String(slugParam || "").trim());
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/-(\d+)$/);
  if (match) return Number(match[1]);
  return null;
}
