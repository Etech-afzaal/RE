import {
  PROPERTY_SUBTYPES_BY_TYPE,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_SUBTYPE_LABELS,
} from "@/lib/propertyTaxonomy";
import { AGENT_PUBLIC_LISTING_GROUPS } from "@/lib/agentPublicListingSections";

/** Allowed property view modes. */
export const PROPERTY_VIEW_MODES = Object.freeze(["categorized", "flat"]);

/** Default property view mode. */
export const DEFAULT_PROPERTY_VIEW_MODE = "categorized";

/** Allowed properties-per-page options for flat view (desktop). */
export const FLAT_PAGE_SIZES = Object.freeze([3, 6, 9, 12]);

/** Default flat-view page size. */
export const DEFAULT_FLAT_PAGE_SIZE = 3;

/**
 * Default: everything enabled so existing agent websites stay unchanged.
 * Shape uses project taxonomy keys (sale/rent/plot + subtypes).
 */
export function defaultWebsiteListingPreferences() {
  const prefs = {};
  for (const type of PROPERTY_TYPES) {
    const types = {};
    for (const subtype of PROPERTY_SUBTYPES_BY_TYPE[type]) {
      types[subtype] = true;
    }
    prefs[type] = { enabled: true, types };
  }
  prefs.property_view_mode = DEFAULT_PROPERTY_VIEW_MODE;
  prefs.flat_page_size = DEFAULT_FLAT_PAGE_SIZE;
  prefs.show_files_rates = true;
  return prefs;
}

/**
 * Extract and normalize the property view mode from preferences.
 * @param {unknown} prefs
 * @returns {"categorized"|"flat"}
 */
export function getPropertyViewMode(prefs) {
  const normalized = normalizeWebsiteListingPreferences(prefs);
  const mode = normalized.property_view_mode;
  return PROPERTY_VIEW_MODES.includes(mode) ? mode : DEFAULT_PROPERTY_VIEW_MODE;
}

/**
 * Flat-view properties per page (desktop). Defaults to 3.
 * @param {unknown} prefs
 * @returns {3|6|9|12}
 */
export function getFlatPageSize(prefs) {
  const normalized = normalizeWebsiteListingPreferences(prefs);
  const size = Number(normalized.flat_page_size);
  return FLAT_PAGE_SIZES.includes(size) ? size : DEFAULT_FLAT_PAGE_SIZE;
}

/** Whether Files Rates appears in the public website navbar. Defaults to true. */
export function isFilesRatesNavEnabled(prefs) {
  const normalized = normalizeWebsiteListingPreferences(prefs);
  return normalized.show_files_rates !== false;
}

/** Friendlier subtype labels for the settings checkboxes. */
export function preferenceSubtypeLabel(type, subtype) {
  if (type === "plot") {
    if (subtype === "residential_plot") return "Residential";
    if (subtype === "commercial_plot") return "Commercial";
  }
  const labels = {
    house: "Houses",
    apartment: "Apartments",
    shop: "Shops",
    commercial: "Commercial",
  };
  return labels[subtype] || PROPERTY_SUBTYPE_LABELS[subtype] || subtype;
}

/**
 * Settings UI labels (parent + children).
 */
export const WEBSITE_LISTING_PREF_OPTIONS = Object.freeze(
  PROPERTY_TYPES.map((type) =>
    Object.freeze({
      type,
      label:
        type === "sale"
          ? "For Sale"
          : type === "rent"
            ? "For Rent"
            : "Plots",
      subtypes: Object.freeze(
        PROPERTY_SUBTYPES_BY_TYPE[type].map((subtype) =>
          Object.freeze({
            subtype,
            label: preferenceSubtypeLabel(type, subtype),
          }),
        ),
      ),
    }),
  ),
);

function asObject(value) {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function coerceBool(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === 0 || value === "0" || value === "false") return false;
  if (value === 1 || value === "1" || value === "true") return true;
  return fallback;
}

/**
 * Merge stored JSON with defaults. Missing / null / invalid → everything on.
 * @param {unknown} raw
 */
export function normalizeWebsiteListingPreferences(raw) {
  const defaults = defaultWebsiteListingPreferences();
  const input = asObject(raw);
  if (!input) return defaults;

  // Accept prompt-style "plots" alias → project key "plot"
  const source = { ...input };
  if (source.plots && !source.plot) {
    source.plot = source.plots;
  }

  const result = {};
  for (const type of PROPERTY_TYPES) {
    const group = asObject(source[type]) || {};
    const typesIn = asObject(group.types) || {};
    const types = {};
    for (const subtype of PROPERTY_SUBTYPES_BY_TYPE[type]) {
      // Accept shortened plot keys from the prompt example
      let rawFlag = typesIn[subtype];
      if (rawFlag === undefined && type === "plot") {
        if (subtype === "residential_plot") {
          rawFlag = typesIn.residential;
        } else if (subtype === "commercial_plot") {
          rawFlag = typesIn.commercial;
        }
      }
      types[subtype] = coerceBool(rawFlag, true);
    }
    result[type] = {
      enabled: coerceBool(group.enabled, true),
      types,
    };
  }

  // Property view mode: "categorized" (default) or "flat"
  const rawMode = source.property_view_mode;
  result.property_view_mode = PROPERTY_VIEW_MODES.includes(rawMode)
    ? rawMode
    : DEFAULT_PROPERTY_VIEW_MODE;

  // Flat view page size: 3 | 6 | 9 | 12 (default 3)
  const rawPageSize = Number(source.flat_page_size);
  result.flat_page_size = FLAT_PAGE_SIZES.includes(rawPageSize)
    ? rawPageSize
    : DEFAULT_FLAT_PAGE_SIZE;

  // Files Rates navbar link — default on when missing
  result.show_files_rates = coerceBool(source.show_files_rates, true);

  return result;
}

/**
 * Validate a preferences payload from the settings API.
 * @param {unknown} raw
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function validateWebsiteListingPreferencesInput(raw) {
  const input = asObject(raw);
  if (!input) {
    return { ok: false, error: "Preferences payload is required." };
  }

  const normalized = normalizeWebsiteListingPreferences(input);
  // Ensure every known key was present in a usable shape after normalize
  for (const type of PROPERTY_TYPES) {
    if (!normalized[type] || typeof normalized[type].enabled !== "boolean") {
      return {
        ok: false,
        error: `Invalid preferences for ${PROPERTY_TYPE_LABELS[type] || type}.`,
      };
    }
  }
  if (!PROPERTY_VIEW_MODES.includes(normalized.property_view_mode)) {
    return { ok: false, error: "Invalid property view mode." };
  }
  if (!FLAT_PAGE_SIZES.includes(normalized.flat_page_size)) {
    return { ok: false, error: "Invalid properties per page option." };
  }
  if (typeof normalized.show_files_rates !== "boolean") {
    return { ok: false, error: "Invalid Files Rates menu preference." };
  }
  return { ok: true, value: normalized };
}

export function isCategoryEnabled(prefs, type) {
  const normalized = normalizeWebsiteListingPreferences(prefs);
  return Boolean(normalized[type]?.enabled);
}

export function isSubtypeEnabled(prefs, type, subtype) {
  const normalized = normalizeWebsiteListingPreferences(prefs);
  const group = normalized[type];
  if (!group?.enabled) return false;
  return Boolean(group.types?.[subtype]);
}

/**
 * Filter agent public listing groups by preferences.
 * @param {unknown} prefs
 */
export function filterListingGroupsByPreferences(prefs) {
  const normalized = normalizeWebsiteListingPreferences(prefs);
  return AGENT_PUBLIC_LISTING_GROUPS.map((group) => {
    if (!normalized[group.type]?.enabled) return null;
    const subtypes = group.subtypes.filter(
      (subtype) => normalized[group.type].types[subtype],
    );
    if (subtypes.length === 0) return null;
    return { ...group, subtypes };
  }).filter(Boolean);
}

/**
 * Filter AGENT_PUBLIC_NAV-style links (items with type + children subtypes).
 * Non-type links (Home, Search Areas) are kept as-is.
 * @param {Array} navLinks
 * @param {unknown} prefs
 */
export function filterNavLinksByPreferences(navLinks, prefs) {
  const normalized = normalizeWebsiteListingPreferences(prefs);
  return (navLinks || [])
    .map((item) => {
      if (!item?.type) return item;
      if (!normalized[item.type]?.enabled) return null;
      const children = (item.children || []).filter((child) =>
        Boolean(normalized[item.type].types[child.subtype]),
      );
      if (children.length === 0) return null;
      return { ...item, children };
    })
    .filter(Boolean);
}
