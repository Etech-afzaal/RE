/**
 * Structured property location helpers.
 *
 * DB stores city / area / phase / address separately. Cards and other compact
 * surfaces keep showing a single combined string:
 *   "{area} {phase}, {city}"  →  "DHA Phase 5, Lahore"
 */

function trimText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

/**
 * Combined display string for cards, lists, WhatsApp, etc.
 * Falls back to the legacy `location` column when structured fields are empty.
 *
 * @param {object} property
 * @returns {string|null}
 */
export function formatPropertyLocation(property) {
  const area = trimText(property?.area);
  const phase = trimText(property?.phase);
  const city = trimText(property?.city);
  const areaPhase = [area, phase].filter(Boolean).join(" ");

  if (areaPhase && city) return `${areaPhase}, ${city}`;
  if (areaPhase) return areaPhase;
  if (city) return city;
  return trimText(property?.location);
}

/**
 * Normalize structured fields from a request body and derive the denormalized
 * `location` string kept for existing card/query consumers.
 *
 * When none of city/area/phase/address are present on the body (legacy clients),
 * only `location` is returned and `hasStructured` is false so callers can leave
 * the structured columns untouched.
 *
 * @param {object} body
 * @returns {{ city: string|null, area: string|null, phase: string|null, address: string|null, location: string|null, hasStructured: boolean }}
 */
export function normalizeLocationFields(body) {
  const source = body && typeof body === "object" ? body : {};
  const hasStructured =
    "city" in source ||
    "area" in source ||
    "phase" in source ||
    "address" in source;

  if (!hasStructured) {
    return {
      city: null,
      area: null,
      phase: null,
      address: null,
      location: trimText(source.location),
      hasStructured: false,
    };
  }

  const city = trimText(source.city);
  const area = trimText(source.area);
  const phase = trimText(source.phase);
  const address = trimText(source.address);

  return {
    city,
    area,
    phase,
    address,
    location:
      formatPropertyLocation({ city, area, phase }) || trimText(source.location),
    hasStructured: true,
  };
}

/**
 * Split a legacy "Area, City" location string when structured columns are empty.
 * @param {string|null|undefined} location
 */
function parseLegacyLocation(location) {
  const raw = trimText(location);
  if (!raw) return { area: null, city: null, full: null };
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      area: parts.slice(0, -1).join(", "),
      city: parts[parts.length - 1],
      full: raw,
    };
  }
  return { area: raw, city: null, full: raw };
}

/**
 * Resolve display/detail fields from a property row.
 * Prefers structured columns; falls back to parsing legacy `location`.
 *
 * @param {object} property
 * @returns {{ area: string|null, phase: string|null, city: string|null, address: string|null, full: string|null }}
 */
export function resolveLocationInfo(property) {
  const area = trimText(property?.area);
  const phase = trimText(property?.phase);
  const city = trimText(property?.city);
  const address = trimText(property?.address);

  if (area || phase || city || address) {
    return {
      area,
      phase,
      city,
      address,
      full: formatPropertyLocation(property),
    };
  }

  const legacy = parseLegacyLocation(property?.location);
  return {
    area: legacy.area,
    phase: null,
    city: legacy.city,
    address: null,
    full: legacy.full,
  };
}
