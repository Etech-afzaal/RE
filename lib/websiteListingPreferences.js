import {
  PROPERTY_SUBTYPES_BY_TYPE,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_SUBTYPE_LABELS,
} from "@/lib/propertyTaxonomy";
import { AGENT_PUBLIC_LISTING_GROUPS } from "@/lib/agentPublicListingSections";

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
  return prefs;
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
