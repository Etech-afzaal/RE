/**
 * Property create / update / submit field validators.
 *
 * Matches the current data model (title, location parts, size, price, description).
 * propertyType in the UI is sale | rent | plot (encoded into the title for public filters).
 */

import { formatPropertyLocation } from "@/lib/propertyLocation";
import {
  collectValues,
  firstError,
  hasHtmlOrScript,
  normalizeMultiline,
  normalizeWhitespace,
  validateDigitCount,
  validateLength,
  validateMessage,
  validateNumberRange,
} from "./common";

export const PROPERTY_TYPES = new Set(["sale", "rent", "plot"]);
export const SIZE_UNITS = new Set(["marla", "kanal", "sqft"]);
export const PRICE_CURRENCIES = new Set(["PKR", "USD"]);
export const DEFAULT_PRICE_CURRENCY = "PKR";

/**
 * Validate fields that the agent may send while saving a draft.
 * Empty optional fields are allowed; provided values must be well-formed.
 * Full completeness (min lengths, location, etc.) is enforced on submit.
 * @param {object} input
 * @param {{ requireTitle?: boolean }} opts
 */
export function validatePropertyDraftInput(input = {}, opts = {}) {
  const { requireTitle = true } = opts;

  const fields = {
    title: validateLength(input.title, {
      required: requireTitle,
      // Drafts only need a non-empty title; min length is enforced on submit.
      min: requireTitle ? 1 : 0,
      max: 50,
    }),
    description: validateLength(input.description, {
      required: false,
      max: 2000,
      multiline: true,
    }),
    city: validateLength(input.city, { required: false, max: 30 }),
    area: validateLength(input.area, { required: false, max: 30 }),
    phase: validateLength(input.phase, { required: false, max: 30 }),
    address: validateLength(input.address, { required: false, max: 100 }),
    size_value: validateNumberRange(input.size_value, {
      required: false,
      maxDigits: 6,
      min: 0,
      allowDecimal: true,
      label: "Size",
    }),
    price: validateNumberRange(input.price, {
      required: false,
      maxDigits: 12,
      min: 0,
      allowDecimal: true,
      label: "Price",
    }),
    bedrooms: validateDigitCount(input.bedrooms, {
      required: false,
      maxDigits: 2,
      min: 0,
      label: "Bedrooms",
    }),
    bathrooms: validateDigitCount(input.bathrooms, {
      required: false,
      maxDigits: 2,
      min: 0,
      label: "Bathrooms",
    }),
    plot_feature: validateLength(input.plot_feature, {
      required: false,
      max: 100,
    }),
  };

  if (input.propertyType != null && String(input.propertyType).trim() !== "") {
    const type = String(input.propertyType).trim().toLowerCase();
    if (!PROPERTY_TYPES.has(type)) {
      return {
        ok: false,
        error: "Property type must be Sale, Rent, or Plot",
        field: "propertyType",
      };
    }
    fields.propertyType = { ok: true, value: type };
  }

  if (input.size_unit != null && String(input.size_unit).trim() !== "") {
    const unit = String(input.size_unit).trim().toLowerCase();
    if (!SIZE_UNITS.has(unit)) {
      return {
        ok: false,
        error: "Size unit must be marla, kanal, or sqft",
        field: "size_unit",
      };
    }
    fields.size_unit = { ok: true, value: unit };
  }

  if (input.price_currency != null && String(input.price_currency).trim() !== "") {
    const currency = String(input.price_currency).trim().toUpperCase();
    if (!PRICE_CURRENCIES.has(currency)) {
      return {
        ok: false,
        error: "Price currency must be PKR or USD",
        field: "price_currency",
      };
    }
    fields.price_currency = { ok: true, value: currency };
  }

  if (fields.description.ok && fields.description.value && hasHtmlOrScript(fields.description.value)) {
    return {
      ok: false,
      error: "Please remove HTML or script tags from the description",
      field: "description",
    };
  }

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  return { ok: true, data: collectValues(fields) };
}

/** Wizard step indices for the Add Property multi-step form. */
export const PROPERTY_WIZARD_STEPS = {
  BASIC: 0,
  LOCATION: 1,
  DETAILS: 2,
  IMAGES: 3,
  VIDEO: 4,
  ACTIONS: 5,
};

/** Live digit caps for numeric wizard fields. */
export const WIZARD_DIGIT_LIMITS = {
  bedrooms: 2,
  bathrooms: 2,
  size_value: 6,
  price: 12,
};

const WIZARD_FIELD_STEP = {
  title: PROPERTY_WIZARD_STEPS.BASIC,
  propertyType: PROPERTY_WIZARD_STEPS.BASIC,
  description: PROPERTY_WIZARD_STEPS.BASIC,
  city: PROPERTY_WIZARD_STEPS.LOCATION,
  area: PROPERTY_WIZARD_STEPS.LOCATION,
  phase: PROPERTY_WIZARD_STEPS.LOCATION,
  address: PROPERTY_WIZARD_STEPS.LOCATION,
  location: PROPERTY_WIZARD_STEPS.LOCATION,
  size_value: PROPERTY_WIZARD_STEPS.DETAILS,
  size_unit: PROPERTY_WIZARD_STEPS.DETAILS,
  bedrooms: PROPERTY_WIZARD_STEPS.DETAILS,
  bathrooms: PROPERTY_WIZARD_STEPS.DETAILS,
  parking: PROPERTY_WIZARD_STEPS.DETAILS,
  price: PROPERTY_WIZARD_STEPS.DETAILS,
  price_currency: PROPERTY_WIZARD_STEPS.DETAILS,
  images: PROPERTY_WIZARD_STEPS.IMAGES,
  videos: PROPERTY_WIZARD_STEPS.VIDEO,
};

/**
 * Map a validated field name to its wizard step index.
 * @param {string} field
 * @returns {number}
 */
export function propertyFieldToWizardStep(field) {
  if (field != null && Object.prototype.hasOwnProperty.call(WIZARD_FIELD_STEP, field)) {
    return WIZARD_FIELD_STEP[field];
  }
  return PROPERTY_WIZARD_STEPS.BASIC;
}

function requiredLabelError(label) {
  return `${label} is required`;
}

function withRequiredLabel(result, value, label) {
  if (result.ok) return result;
  if (!normalizeWhitespace(value) && result.error === "This field is required") {
    return { ok: false, error: requiredLabelError(label) };
  }
  return result;
}

/**
 * Keep digits only and enforce a max digit count while typing.
 * Blocks extra digits and always surfaces a limit message (typing or paste).
 * @param {unknown} raw
 * @param {number} maxDigits
 * @param {{ previous?: unknown }} [opts]
 * @returns {{ value: string, limitError: string|null }}
 */
export function sanitizeWizardDigitInput(raw, maxDigits, opts = {}) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length > maxDigits) {
    return {
      value: digits.slice(0, maxDigits),
      limitError: `Maximum ${maxDigits} digits allowed`,
    };
  }
  return { value: digits, limitError: null };
}

/**
 * City: letters (and spaces / hyphen / apostrophe) only, capped at max length.
 * @param {unknown} raw
 * @param {number} [max=30]
 * @param {{ previous?: unknown }} [opts]
 * @returns {{ value: string, limitError: string|null }}
 */
export function sanitizeWizardCityInput(raw, max = 30, opts = {}) {
  const previous = String(opts.previous ?? "");
  const cleaned = String(raw ?? "").replace(/[^\p{L}\s'-]/gu, "");
  if (cleaned.length > max) {
    const prevCleaned = previous.replace(/[^\p{L}\s'-]/gu, "");
    const bulkInsert =
      cleaned.length - prevCleaned.length > 1 ||
      String(raw ?? "").length - previous.length > 1;
    return {
      value: cleaned.slice(0, max),
      limitError: bulkInsert ? `Maximum ${max} characters allowed` : null,
    };
  }
  return { value: cleaned, limitError: null };
}

/**
 * Soft length cap while typing for free-text fields.
 * Extra keystrokes are blocked silently; limit messages are for paste/bulk input.
 * @param {unknown} raw
 * @param {number} max
 * @param {{ previous?: unknown }} [opts]
 * @returns {{ value: string, limitError: string|null }}
 */
export function sanitizeWizardTextInput(raw, max, opts = {}) {
  const previous = String(opts.previous ?? "");
  const text = String(raw ?? "");
  if (text.length > max) {
    const bulkInsert = text.length - previous.length > 1;
    return {
      value: text.slice(0, max),
      limitError: bulkInsert ? `Maximum ${max} characters allowed` : null,
    };
  }
  return { value: text, limitError: null };
}

function validateCityField(value, { required = false } = {}) {
  const lengthResult = withRequiredLabel(
    validateLength(value, { required, max: 30 }),
    value,
    "City",
  );
  if (!lengthResult.ok) return lengthResult;
  if (!lengthResult.value) return { ok: true, value: "" };

  if (!/^[\p{L}][\p{L}\s'-]*$/u.test(lengthResult.value)) {
    return { ok: false, error: "City must contain letters only" };
  }
  return lengthResult;
}

/**
 * Error message for a single wizard field (live validation).
 * @param {string} field
 * @param {object} form
 * @returns {string|null}
 */
export function getPropertyWizardFieldError(field, form = {}) {
  const propertyType = String(form.propertyType || "").toLowerCase();

  switch (field) {
    case "title": {
      const title = withRequiredLabel(
        validateLength(form.title, { required: true, min: 10, max: 50 }),
        form.title,
        "Title",
      );
      return title.ok ? null : title.error;
    }
    case "propertyType": {
      if (!propertyType) return requiredLabelError("Property type");
      if (!PROPERTY_TYPES.has(propertyType)) {
        return "Property type must be Sale, Rent, or Plot";
      }
      return null;
    }
    case "description": {
      const description = validateMessage(form.description, {
        required: false,
        min: 0,
        max: 2000,
      });
      return description.ok ? null : description.error;
    }
    case "city": {
      const city = validateCityField(form.city, { required: true });
      return city.ok ? null : city.error;
    }
    case "area": {
      const area = validateLength(form.area, { required: false, max: 30 });
      return area.ok ? null : area.error;
    }
    case "phase": {
      const phase = validateLength(form.phase, { required: false, max: 30 });
      return phase.ok ? null : phase.error;
    }
    case "address": {
      const address = withRequiredLabel(
        validateLength(form.address, { required: true, min: 10, max: 100 }),
        form.address,
        "Address",
      );
      return address.ok ? null : address.error;
    }
    case "size_value": {
      const empty =
        form.size_value == null || String(form.size_value).trim() === "";
      const sizeValue = validateNumberRange(form.size_value, {
        required: true,
        maxDigits: WIZARD_DIGIT_LIMITS.size_value,
        min: 1,
        allowDecimal: false,
        label: "Size",
      });
      if (sizeValue.ok) return null;
      if (empty || sizeValue.error === "This field is required") {
        return requiredLabelError("Size");
      }
      return sizeValue.error;
    }
    case "price": {
      const empty = form.price == null || String(form.price).trim() === "";
      const price = validateNumberRange(form.price, {
        required: true,
        maxDigits: WIZARD_DIGIT_LIMITS.price,
        min: 1,
        allowDecimal: false,
        label: "Price",
      });
      if (price.ok) return null;
      if (empty || price.error === "This field is required") {
        return requiredLabelError("Price");
      }
      return price.error;
    }
    case "bedrooms": {
      // Optional — format only when a value is present.
      const bedrooms = validateDigitCount(form.bedrooms, {
        required: false,
        maxDigits: WIZARD_DIGIT_LIMITS.bedrooms,
        min: 0,
        label: "Bedrooms",
      });
      return bedrooms.ok ? null : bedrooms.error;
    }
    case "bathrooms": {
      // Optional — format only when a value is present.
      const bathrooms = validateDigitCount(form.bathrooms, {
        required: false,
        maxDigits: WIZARD_DIGIT_LIMITS.bathrooms,
        min: 0,
        label: "Bathrooms",
      });
      return bathrooms.ok ? null : bathrooms.error;
    }
    default:
      return null;
  }
}

/**
 * Collect all submit-time field errors (does not stop at the first failure).
 * @param {object} form
 * @returns {{ ok: boolean, fieldErrors: Record<string, string>, error?: string, field?: string }}
 */
export function validatePropertyWizardFields(form = {}) {
  const fields = [
    "title",
    "propertyType",
    "description",
    "city",
    "area",
    "phase",
    "address",
    "size_value",
    "price",
    "bedrooms",
    "bathrooms",
  ];

  const fieldErrors = {};
  for (const field of fields) {
    const error = getPropertyWizardFieldError(field, form);
    if (error) fieldErrors[field] = error;
  }

  const keys = Object.keys(fieldErrors);
  if (keys.length === 0) {
    return { ok: true, fieldErrors: {} };
  }

  const field = keys[0];
  return {
    ok: false,
    fieldErrors,
    field,
    error: fieldErrors[field],
  };
}

/**
 * Validate a single wizard step's required / format rules.
 * Steps 3–4 (images/videos) are validated by the page (file UI state).
 * @param {number} stepIndex
 * @param {object} form
 */
export function validatePropertyWizardStep(stepIndex, form = {}) {
  const all = validatePropertyWizardFields(form);
  const stepFieldsByIndex = {
    [PROPERTY_WIZARD_STEPS.BASIC]: ["title", "propertyType", "description"],
    [PROPERTY_WIZARD_STEPS.LOCATION]: ["city", "area", "phase", "address"],
    [PROPERTY_WIZARD_STEPS.DETAILS]: [
      "size_value",
      "price",
      "bedrooms",
      "bathrooms",
    ],
    [PROPERTY_WIZARD_STEPS.IMAGES]: [],
    [PROPERTY_WIZARD_STEPS.VIDEO]: [],
    [PROPERTY_WIZARD_STEPS.ACTIONS]: [],
  };

  const stepFields = stepFieldsByIndex[stepIndex] || [];
  if (stepFields.length === 0) {
    return { ok: true, fieldErrors: {} };
  }

  const fieldErrors = {};
  for (const field of stepFields) {
    if (all.fieldErrors[field]) {
      fieldErrors[field] = all.fieldErrors[field];
    }
  }

  const keys = Object.keys(fieldErrors);
  if (keys.length === 0) {
    return { ok: true, fieldErrors: {} };
  }

  return {
    ok: false,
    fieldErrors,
    field: keys[0],
    error: fieldErrors[keys[0]],
  };
}

/**
 * Client-side checks before submit-for-approval.
 * Mirrors server completeness without inventing stricter required fields.
 */
export function validatePropertyFormSteps(form = {}) {
  const wizard = validatePropertyWizardFields(form);
  if (!wizard.ok) {
    return {
      ok: false,
      error: wizard.error,
      field: wizard.field,
    };
  }

  const propertyType = String(form.propertyType || "").toLowerCase();
  const locationText =
    formatPropertyLocation({
      city: form.city,
      area: form.area,
      phase: form.phase,
    }) || normalizeWhitespace(form.location);

  return {
    ok: true,
    data: {
      title: normalizeWhitespace(form.title),
      propertyType,
      description: normalizeMultiline(form.description),
      city: normalizeWhitespace(form.city),
      area: normalizeWhitespace(form.area),
      phase: normalizeWhitespace(form.phase),
      address: normalizeWhitespace(form.address),
      location: locationText,
      size_value:
        form.size_value === "" || form.size_value == null
          ? null
          : Number(form.size_value),
      price: Number(form.price),
      price_currency: PRICE_CURRENCIES.has(
        String(form.price_currency || "").trim().toUpperCase(),
      )
        ? String(form.price_currency).trim().toUpperCase()
        : DEFAULT_PRICE_CURRENCY,
      bedrooms:
        form.bedrooms === "" || form.bedrooms == null
          ? null
          : Number(form.bedrooms),
      bathrooms:
        form.bathrooms === "" || form.bathrooms == null
          ? null
          : Number(form.bathrooms),
    },
  };
}

/**
 * Completeness + format checks used when submitting for admin review.
 * Preserves existing sale/rent/plot-in-title rule used by the public site.
 */
export function validatePropertySubmissionFields(property = {}) {
  const errors = [];
  const title = normalizeWhitespace(property?.title);
  const description = String(property?.description ?? "").trim();
  const city = normalizeWhitespace(property?.city);
  const area = normalizeWhitespace(property?.area);
  const address = normalizeWhitespace(property?.address);

  if (!title) {
    errors.push("Property title is required.");
  } else if (title.length < 10) {
    errors.push("Property title must be at least 10 characters.");
  } else if (title.length > 50) {
    errors.push("Maximum 50 characters allowed for title.");
  }

  // Description is optional; validate format only when provided.
  if (description) {
    if (description.length > 2000) {
      errors.push("Maximum 2000 characters allowed for description.");
    } else if (hasHtmlOrScript(description)) {
      errors.push("Please remove HTML or script tags from the description.");
    }
  }

  const cityResult = validateCityField(property?.city, { required: true });
  if (!cityResult.ok) {
    errors.push(
      cityResult.error === requiredLabelError("City") ||
        cityResult.error === "This field is required"
        ? "City is required."
        : cityResult.error,
    );
  }

  if (area && area.length > 30) {
    errors.push("Maximum 30 characters allowed for area.");
  }
  if (property?.phase && normalizeWhitespace(property.phase).length > 30) {
    errors.push("Maximum 30 characters allowed for phase.");
  }

  if (!address) {
    errors.push("Address is required.");
  } else if (address.length < 10) {
    errors.push("Minimum 10 characters required");
  } else if (address.length > 100) {
    errors.push("Maximum 100 characters allowed for address.");
  }

  const sizeResult = validateNumberRange(property?.size_value, {
    required: true,
    maxDigits: WIZARD_DIGIT_LIMITS.size_value,
    min: 0.01,
    allowDecimal: true,
    label: "Size",
  });
  if (!sizeResult.ok) {
    errors.push(
      sizeResult.error === "This field is required"
        ? "Size is required."
        : sizeResult.error,
    );
  }

  const priceResult = validateNumberRange(property?.price, {
    required: true,
    maxDigits: WIZARD_DIGIT_LIMITS.price,
    min: 0.01,
    allowDecimal: true,
    label: "Price",
  });
  if (!priceResult.ok) {
    errors.push(
      priceResult.error === "This field is required"
        ? "A price greater than zero is required."
        : priceResult.error,
    );
  }

  if (
    property?.price_currency != null &&
    String(property.price_currency).trim() !== ""
  ) {
    const currency = String(property.price_currency).trim().toUpperCase();
    if (!PRICE_CURRENCIES.has(currency)) {
      errors.push("Price currency must be PKR or USD.");
    }
  }

  return errors;
}
