/**
 * Central property type + subtype taxonomy and validation.
 * property_type is the top-level listing class; property_subtype is the kind.
 */

export const PROPERTY_TYPES = Object.freeze(["sale", "rent", "plot"]);

export const PROPERTY_SUBTYPES_BY_TYPE = Object.freeze({
  sale: Object.freeze(["house", "apartment", "shop", "commercial"]),
  rent: Object.freeze(["house", "apartment", "shop", "commercial"]),
  plot: Object.freeze(["residential_plot", "commercial_plot"]),
});

export const PROPERTY_SUBTYPE_LABELS = Object.freeze({
  house: "House",
  apartment: "Apartment",
  shop: "Shop",
  commercial: "Commercial",
  residential_plot: "Residential",
  commercial_plot: "Commercial",
});

/** Card / detail display labels (plots keep "Plot" in the label). */
export const PROPERTY_SUBTYPE_DISPLAY_LABELS = Object.freeze({
  house: "House",
  apartment: "Apartment",
  shop: "Shop",
  commercial: "Commercial",
  residential_plot: "Residential Plot",
  commercial_plot: "Commercial Plot",
});

export const PROPERTY_TYPE_LABELS = Object.freeze({
  sale: "Sale",
  rent: "Rent",
  plot: "Plot",
});

export const PROPERTY_TYPE_LISTING_LABELS = Object.freeze({
  sale: "For Sale",
  rent: "For Rent",
  plot: "For Sale",
});

/** Nav children for Sale / Rent / Plots (agent public + default header). */
export const PROPERTY_TYPE_NAV = Object.freeze([
  {
    type: "sale",
    label: "For Sale",
    href: "#sale",
    children: [
      { label: "Houses", subtype: "house" },
      { label: "Apartments", subtype: "apartment" },
      { label: "Shops", subtype: "shop" },
      { label: "Commercial", subtype: "commercial" },
    ],
  },
  {
    type: "rent",
    label: "For Rent",
    href: "#rent",
    children: [
      { label: "Houses", subtype: "house" },
      { label: "Apartments", subtype: "apartment" },
      { label: "Shops", subtype: "shop" },
      { label: "Commercial", subtype: "commercial" },
    ],
  },
  {
    type: "plot",
    label: "Plots",
    href: "#plots",
    children: [
      { label: "Residential", subtype: "residential_plot" },
      { label: "Commercial", subtype: "commercial_plot" },
    ],
  },
]);

/**
 * @param {unknown} value
 * @returns {"sale"|"rent"|"plot"|null}
 */
export function normalizePropertyType(value) {
  const type = String(value ?? "")
    .trim()
    .toLowerCase();
  return PROPERTY_TYPES.includes(type) ? type : null;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizePropertySubtype(value) {
  const subtype = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!subtype) return null;
  const all = Object.values(PROPERTY_SUBTYPES_BY_TYPE).flat();
  return all.includes(subtype) ? subtype : null;
}

/**
 * @param {unknown} type
 * @param {unknown} subtype
 */
export function isValidPropertyTypeSubtype(type, subtype) {
  const t = normalizePropertyType(type);
  const s = normalizePropertySubtype(subtype);
  if (!t || !s) return false;
  return PROPERTY_SUBTYPES_BY_TYPE[t].includes(s);
}

/**
 * Authoritative combination check for create/update/submit paths.
 * @param {unknown} type
 * @param {unknown} subtype
 * @param {{ required?: boolean }} [opts]
 * @returns {{ ok: true, property_type: string|null, property_subtype: string|null }
 *   | { ok: false, error: string, field: string }}
 */
export function validatePropertyTypeSubtype(type, subtype, opts = {}) {
  const { required = false } = opts;
  const rawType = type == null ? "" : String(type).trim();
  const rawSubtype = subtype == null ? "" : String(subtype).trim();

  if (!rawType && !rawSubtype) {
    if (required) {
      return {
        ok: false,
        error: "Property type is required",
        field: "propertyType",
      };
    }
    return { ok: true, property_type: null, property_subtype: null };
  }

  const property_type = normalizePropertyType(rawType);
  if (!property_type) {
    return {
      ok: false,
      error: "Property type must be Sale, Rent, or Plot",
      field: "propertyType",
    };
  }

  if (!rawSubtype) {
    if (required) {
      return {
        ok: false,
        error: "Property subtype is required",
        field: "propertySubtype",
      };
    }
    return { ok: true, property_type, property_subtype: null };
  }

  const property_subtype = normalizePropertySubtype(rawSubtype);
  if (!property_subtype || !PROPERTY_SUBTYPES_BY_TYPE[property_type].includes(property_subtype)) {
    return {
      ok: false,
      error: "Property subtype is not valid for the selected property type",
      field: "propertySubtype",
    };
  }

  return { ok: true, property_type, property_subtype };
}

/**
 * @param {unknown} type
 * @returns {{ value: string, label: string }[]}
 */
export function subtypesForType(type) {
  const t = normalizePropertyType(type);
  if (!t) return [];
  return PROPERTY_SUBTYPES_BY_TYPE[t].map((value) => ({
    value,
    label: PROPERTY_SUBTYPE_LABELS[value] || value,
  }));
}

/**
 * @param {unknown} subtype
 * @returns {string|null}
 */
export function propertySubtypeLabel(subtype) {
  const s = normalizePropertySubtype(subtype);
  if (!s) return null;
  return PROPERTY_SUBTYPE_DISPLAY_LABELS[s] || PROPERTY_SUBTYPE_LABELS[s] || s;
}

/**
 * Infer top-level type from existing free-text (legacy title encoding).
 * @param {{ title?: string, description?: string, property_type?: string }} property
 * @returns {"sale"|"rent"|"plot"|null}
 */
export function inferPropertyTypeFromText(property) {
  const stored = normalizePropertyType(property?.property_type);
  if (stored) return stored;
  const text = `${property?.title ?? ""} ${property?.description ?? ""}`;
  if (/\bplot\b/i.test(text)) return "plot";
  if (/\brent(ed|al)?\b/i.test(text)) return "rent";
  if (/\bsale\b/i.test(text)) return "sale";
  return null;
}

/**
 * Infer subtype from title/description for migration / legacy rows.
 * Returns null when classification is unsafe.
 * @param {"sale"|"rent"|"plot"} type
 * @param {{ title?: string, description?: string }} property
 * @returns {string|null}
 */
export function inferPropertySubtypeFromText(type, property) {
  const t = normalizePropertyType(type);
  if (!t) return null;
  const text = `${property?.title ?? ""} ${property?.description ?? ""}`.toLowerCase();

  if (t === "plot") {
    if (/\bcommercial\b/.test(text)) return "commercial_plot";
    if (/\bresidential\b/.test(text)) return "residential_plot";
    // Corner / generic plots without commercial wording are residential in this dataset.
    if (/\bplot\b/.test(text)) return "residential_plot";
    return null;
  }

  if (/\b(apartment|flat|studio)\b/.test(text)) return "apartment";
  if (/\bshop\b/.test(text)) return "shop";
  if (
    /\bcommercial\b/.test(text) &&
    !/\b(house|bungalow|villa|portion)\b/.test(text)
  ) {
    return "commercial";
  }
  if (/\b(house|bungalow|villa|portion)\b/.test(text)) return "house";

  // Sale/rent listings without an explicit kind default to house only when
  // the title clearly describes a dwelling sale/rent listing.
  if (/\b(for sale|for rent)\b/.test(text)) return "house";
  return null;
}
