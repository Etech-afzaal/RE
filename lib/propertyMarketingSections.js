/**
 * Validation / normalization for the four optional agent-editable
 * property marketing sections (stored as JSON columns on properties).
 *
 * All sections are optional. Empty arrays normalize to null so nothing is
 * stored for a section the agent left blank.
 */
import {
  hasHtmlOrScript,
  normalizeMultiline,
  normalizeWhitespace,
} from "./validators/common";

export const MARKETING_LIMITS = {
  propertyHighlights: 6,
  whyThisHome: 6,
  locationAdvantages: 12,
  investmentInsights: 6,
};

const MAX_TEXT = {
  highlightTitle: 100,
  highlightDescription: 300,
  checklistItem: 200,
  locationName: 100,
  locationDescription: 300,
  icon: 50,
};

const FIELDS = [
  "property_highlights",
  "why_this_home",
  "location_advantages",
  "investment_insights",
];

const LABELS = {
  property_highlights: "Property Highlights",
  why_this_home: "Why This Home?",
  location_advantages: "Location Advantages",
  investment_insights: "Investment Insights",
};

function bad(value, max) {
  return hasHtmlOrScript(value) || String(value || "").length > max;
}

function clean(value, max) {
  const text = normalizeWhitespace(value);
  return text.length > max ? text.slice(0, max) : text;
}

function cleanMulti(value, max) {
  const text = normalizeMultiline(value);
  return text.length > max ? text.slice(0, max) : text;
}

function normalizeHighlight(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const title = clean(item.title, MAX_TEXT.highlightTitle);
  const description = cleanMulti(
    item.description,
    MAX_TEXT.highlightDescription,
  );
  const icon = clean(item.icon, MAX_TEXT.icon);
  if (!title && !description) return null;
  if (bad(title, MAX_TEXT.highlightTitle))
    return { error: "Highlight titles are too long or contain HTML/script tags." };
  if (bad(description, MAX_TEXT.highlightDescription))
    return {
      error:
        "Highlight descriptions are too long or contain HTML/script tags.",
    };
  if (bad(icon, MAX_TEXT.icon))
    return { error: "Highlight icons are too long." };
  if (!/^[a-zA-Z0-9_-]*$/.test(String(icon || "")))
    return {
      error:
        "Highlight icons may only use letters, numbers, hyphens, and underscores.",
    };
  return { value: { title, description, icon } };
}

function normalizeChecklistItem(item) {
  const text = clean(item, MAX_TEXT.checklistItem);
  if (!text) return null;
  if (bad(text, MAX_TEXT.checklistItem))
    return {
      error: "Checklist items are too long or contain HTML/script tags.",
    };
  return { value: text };
}

function normalizeLocation(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const name = clean(item.name, MAX_TEXT.locationName);
  const description = cleanMulti(
    item.description,
    MAX_TEXT.locationDescription,
  );
  if (!name && !description) return null;
  if (bad(name, MAX_TEXT.locationName))
    return { error: "Location names are too long or contain HTML/script tags." };
  if (bad(description, MAX_TEXT.locationDescription))
    return {
      error:
        "Location descriptions are too long or contain HTML/script tags.",
    };
  return { value: { name, description } };
}

/**
 * Normalize one marketing section payload from an agent form.
 * @param {unknown} raw
 * @param {string} field
 * @returns {{ ok: true, value: null | unknown[] } | { ok: false, error: string, field: string }}
 */
export function normalizeMarketingSection(raw, field) {
  if (raw === undefined) return { ok: true, value: null };
  if (raw == null || raw === "") return { ok: true, value: null };

  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return { ok: false, error: `${LABELS[field]} must be a list.`, field };
    }
  }
  if (!Array.isArray(arr)) {
    return { ok: false, error: `${LABELS[field]} must be a list.`, field };
  }

  const max = MARKETING_LIMITS[field];
  if (arr.length > max) {
    return {
      ok: false,
      error: `${LABELS[field]} allows a maximum of ${max} items.`,
      field,
    };
  }

  const values = [];
  const errors = [];
  for (const item of arr) {
    let normalized;
    if (field === "property_highlights") normalized = normalizeHighlight(item);
    else if (field === "why_this_home" || field === "investment_insights")
      normalized = normalizeChecklistItem(item);
    else normalized = normalizeLocation(item);

    if (normalized?.error) {
      errors.push(normalized.error);
      continue;
    }
    if (normalized?.value) values.push(normalized.value);
  }

  if (errors.length > 0) return { ok: false, error: errors[0], field };
  return { ok: true, value: values.length > 0 ? values : null };
}

/**
 * Normalize all four marketing sections in one payload.
 * @param {object} input
 * @returns {{ ok: true, data: Record<string, unknown[]> } | { ok: false, error: string, field: string }}
 */
export function normalizeMarketingSections(input = {}) {
  const data = {};
  for (const field of FIELDS) {
    const result = normalizeMarketingSection(input[field], field);
    if (!result.ok) return result;
    data[field] = result.value;
  }
  return { ok: true, data };
}