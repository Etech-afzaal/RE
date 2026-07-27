/**
 * Public property URL helpers.
 * Format: /re/{agentUsername}/{slugified-title}-{id}
 * Numeric IDs still resolve for older links.
 */

export function slugifyTitle(title) {
  const slug = String(title || "property")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "property";
}

export function buildPropertySlug(property) {
  const id = property?.id;
  if (id == null) return slugifyTitle(property?.title);
  return `${slugifyTitle(property.title)}-${id}`;
}

export function agentPublicUsername(agentOrProperty) {
  if (!agentOrProperty) return "";
  return (
    agentOrProperty.username ||
    agentOrProperty.estate_name ||
    ""
  );
}

export function propertyPublicPath(agentUsername, property) {
  const user = agentUsername || agentPublicUsername(property);
  if (!user || !property?.id) return "#";
  return `/re/${encodeURIComponent(user)}/${buildPropertySlug(property)}`;
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
