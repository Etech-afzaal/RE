import { readPropertyData } from "./propertyData";

/** Keep the existing API/view contract, deriving every migrated field ONLY from
 * JSON. These are response projections, never fallback database columns.
 */
export function propertyRecord(row) {
  if (!row) return row;
  const data = readPropertyData(row.property_data) || {};
  return {
    ...row,
    property_type: data.listing_type ?? null,
    property_subtype: data.property_type ?? null,
    city: data.location?.city ?? null,
    area: data.location?.area ?? null,
    phase: data.location?.phase ?? null,
    address: data.location?.address ?? null,
    rejected_reason: data.rejection?.reason ?? null,
    rejected_by: data.rejection?.rejected_by ?? null,
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
