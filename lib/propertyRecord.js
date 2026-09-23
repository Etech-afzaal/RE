import { readPropertyData } from "./propertyData";
import { resolveLocationInfo } from "./propertyLocation";

function cleanLocationText(value) {
  const text = String(value ?? "").trim();
  if (!text || /^(null|undefined)$/i.test(text)) return null;
  return text;
}

/** Keep the existing API/view contract, deriving migrated fields from JSON and
 * falling back to legacy `location` text for city/area when structured data is empty.
 */
export function propertyRecord(row) {
  if (!row) return row;
  const data = readPropertyData(row.property_data) || {};
  const projected = {
    ...row,
    property_type: data.listing_type ?? null,
    property_subtype: data.property_type ?? null,
    city: cleanLocationText(data.location?.city),
    area: cleanLocationText(data.location?.area),
    phase: cleanLocationText(data.location?.phase),
    address: cleanLocationText(data.location?.address),
    rejected_reason: data.rejection?.reason ?? null,
    rejected_by: data.rejection?.rejected_by ?? null,
  };
  const resolved = resolveLocationInfo(projected);
  return {
    ...projected,
    city: resolved.city,
    area: resolved.area,
    phase: resolved.phase,
    address: resolved.address,
  };
}

/** SQL search uses JSON strings with the original columns' case-insensitive
 * collation. JSON null must be SQL NULL, not the text 'null'. Paths are static.
 */
export function propertyLocationSQL(field) {
  if (!["city", "area", "phase", "address"].includes(field)) throw new Error("Invalid location field");
  return `JSON_VALUE(p.property_data, '$.location.${field}' RETURNING CHAR(255)) COLLATE utf8mb4_0900_ai_ci`;
}

/** Retain the existing request field names while also accepting JSON-only clients. */
export function propertyRequest(body) {
  const data = readPropertyData(body.property_data);
  if (!data) return body;
  return {
    ...data.location,
    ...(Object.hasOwn(data, "listing_type") ? { propertyType: data.listing_type } : {}),
    ...(Object.hasOwn(data, "property_type") ? { propertySubtype: data.property_type } : {}),
    ...body,
  };
}
