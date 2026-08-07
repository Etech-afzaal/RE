/**
 * Completeness rules a listing must satisfy before an admin is asked to review
 * it. Enforced server-side on every submission path — the client copy of these
 * rules is only there to give faster feedback.
 */

import { formatPropertyLocation } from "@/lib/propertyLocation";

/**
 * The public site derives sale / rent / plot from the listing text
 * (see components/HomeListings.js), so a submittable listing has to name one.
 */
const PROPERTY_TYPE_PATTERN = /\b(sale|rent|rented|rental|plot)\b/i;

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

/** @returns {"sale"|"rent"|"plot"|null} */
export function derivePropertyType(property) {
  const text = `${property?.title ?? ""} ${property?.description ?? ""}`;
  if (/\bplot\b/i.test(text)) return "plot";
  if (/\brent(ed|al)?\b/i.test(text)) return "rent";
  if (/\bsale\b/i.test(text)) return "sale";
  return null;
}

/**
 * @param {object} property row-shaped listing values
 * @param {number} imageCount how many images are attached
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePropertyForSubmission(property, imageCount) {
  const errors = [];

  if (!hasText(property?.title)) {
    errors.push("Property title is required.");
  }
  if (!hasText(property?.description)) {
    errors.push("Description is required.");
  }
  if (!hasText(formatPropertyLocation(property))) {
    errors.push("Location is required.");
  }

  const price = Number(property?.price);
  if (!Number.isFinite(price) || price <= 0) {
    errors.push("A price greater than zero is required.");
  }

  if (!PROPERTY_TYPE_PATTERN.test(`${property?.title ?? ""} ${property?.description ?? ""}`)) {
    errors.push(
      'Property type is required — the title must say "for Sale", "for Rent", or "Plot".',
    );
  }

  if (!(Number(imageCount) > 0)) {
    errors.push("At least one image is required.");
  }

  return { valid: errors.length === 0, errors };
}
