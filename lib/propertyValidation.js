/**
 * Completeness rules a listing must satisfy before an admin is asked to review
 * it. Enforced server-side on every submission path — the client copy of these
 * rules is only there to give faster feedback.
 */

import {
  inferPropertyTypeFromText,
  validatePropertyTypeSubtype,
} from "@/lib/propertyTaxonomy";
import { validatePropertySubmissionFields } from "@/lib/validators/propertyValidator";

/**
 * Fallback for legacy rows that still encode sale/rent/plot only in the title.
 */
const PROPERTY_TYPE_PATTERN = /\b(sale|rent|rented|rental|plot)\b/i;

/** @returns {"sale"|"rent"|"plot"|null} */
export function derivePropertyType(property) {
  return inferPropertyTypeFromText(property);
}

/**
 * @param {object} property row-shaped listing values
 * @param {number} imageCount how many images are attached
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePropertyForSubmission(property, imageCount) {
  const errors = validatePropertySubmissionFields(property);

  const storedType = property?.property_type ?? property?.propertyType;
  const storedSubtype = property?.property_subtype ?? property?.propertySubtype;
  const combo = validatePropertyTypeSubtype(storedType, storedSubtype, {
    required: true,
  });

  if (!combo.ok) {
    // Allow legacy title-encoded type only when subtype is already valid for it.
    const legacyType = inferPropertyTypeFromText(property);
    const legacyCombo = validatePropertyTypeSubtype(
      legacyType,
      storedSubtype,
      { required: true },
    );
    if (!legacyCombo.ok) {
      errors.push(
        combo.field === "propertySubtype" || legacyCombo.field === "propertySubtype"
          ? "Property subtype is required and must match the property type."
          : PROPERTY_TYPE_PATTERN.test(
                `${property?.title ?? ""} ${property?.description ?? ""}`,
              )
            ? "Property subtype is required and must match the property type."
            : "Property type is required — choose Sale, Rent, or Plot.",
      );
    }
  }

  if (!(Number(imageCount) > 0)) {
    errors.push("At least one image is required.");
  }

  return { valid: errors.length === 0, errors };
}
