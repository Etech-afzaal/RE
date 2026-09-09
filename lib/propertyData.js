import { normalizeMarketingSections } from "./propertyMarketingSections";
import { hasHtmlOrScript } from "./validators/common";

export const PROPERTY_KIND_OPTIONS = {
  sale: ["house", "apartment", "commercial", "plots", "file"],
  rent: ["house", "apartment", "commercial"],
};
export const PROPERTY_KIND_LABELS = {
  house: "House", apartment: "Apartment", commercial: "Commercial", plots: "Plots", file: "File",
};
export const INSIGHT_FIELDS = ["property_highlights", "why_this_home", "location_advantages", "investment_insights"];
const positions = ["Normal", "Corner", "Park Facing", "Main Boulevard", "Green Belt Facing"];
const field = (key, label, options) => ({ key, label, options });
export const PROPERTY_DATA_FIELDS = {
  landInfo: [field("dimension", "Dimension"), field("front", "Front (ft)"), field("depth", "Depth (ft)"), field("plotPosition", "Plot Position", positions), field("roadWidth", "Road Width")],
  propertyDetails: [field("coveredArea", "Covered Area (sqft)"), field("floors", "Floors / Stories"), field("lounge", "Lounge"), field("kitchens", "Kitchens"), field("amenities", "Amenities")],
  commercialInfo: [field("commercialType", "Commercial Type", ["Shop", "Plaza", "Office", "Warehouse", "Building", "Other"])],
  plotInfo: [
    field("plotDimensions", "Plot Dimensions"),
    field("plotType", "Plot Type", ["Residential", "Commercial"]),
    field("plotPosition", "Plot Position", positions),
    field("facing", "Facing", ["North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West"]),
    field("roadWidth", "Road Width"),
    field("developmentStatus", "Development Status", ["Developed", "Partially Developed", "Under Development", "Undeveloped"]),
    field("possession", "Possession", ["Available", "Not Available"]),
    field("boundaryWall", "Boundary Wall", ["Yes", "No"]),
    field("landLevel", "Land Level", ["Level", "Elevated", "Lowered"]),
    field("amenities", "Amenities", ["Electricity", "Gas", "Sewerage", "Water", "Others"]),
  ],
};
const numericFields = new Set(["front", "depth", "coveredArea", "floors", "lounge", "kitchens", "bedrooms", "bathrooms"]);
const counts = new Set(["floors", "lounge", "kitchens", "bedrooms", "bathrooms"]);

export function propertyKind(type, subtype) {
  if (type === "plot") return "plots";
  if (subtype === "shop") return "commercial";
  return subtype || "";
}

export function propertyWizardSteps(kind) {
  const building = !["plots", "file"].includes(kind);
  const labels = ["Basic Information", "Location", ...(building ? ["Land Info", "Property Details"] : [kind === "file" ? "Plot Info" : "Plot Information"]), "Images", "Videos", "Insights & Submission"];
  return { labels, BASIC: 0, LOCATION: 1, LAND: 2, DETAILS: building ? 3 : 2, IMAGES: labels.length - 3, VIDEO: labels.length - 2, ACTIONS: labels.length - 1 };
}

export function changePropertySelection(form, listing, kind) {
  const selected = PROPERTY_KIND_OPTIONS[listing]?.includes(kind) ? kind : "";
  return {
    ...form, propertyKind: selected,
    propertyType: selected === "plots" ? "plot" : listing,
    propertySubtype: selected === "plots" ? "residential_plot" : selected,
    property_data: {}, bedrooms: "", bathrooms: "", parking: "No", plotSizePreset: "Other",
    size_value: "", size_unit: "marla",
  };
}

export function fieldsForSection(section, kind) {
  const fields = PROPERTY_DATA_FIELDS[section] || [];
  if (section !== "plotInfo" || kind !== "file") return fields;
  return fields.filter(({ key }) => ["plotType", "amenities"].includes(key)).map(f => f.key === "amenities" ? { ...f, options: ["Electricity", "Gas", "Others"] } : f);
}

export function sectionsForKind(kind) {
  if (["plots", "file"].includes(kind)) return ["plotInfo"];
  if (["house", "apartment", "commercial"].includes(kind)) return ["landInfo", "propertyDetails", ...(kind === "commercial" ? ["commercialInfo"] : [])];
  return [];
}

export function readPropertyData(raw) {
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
}

// Size remains in size_value/size_unit; it is never moved or duplicated into JSON.
export function buildPropertyData(form) {
  const kind = propertyKind(form.propertyType, form.propertySubtype);
  const stored = readPropertyData(form.property_data) || {};
  const data = {};
  for (const section of sectionsForKind(kind)) data[section] = { ...stored[section] };
  if (kind === "plots") data.plotInfo.plotType = form.propertySubtype === "commercial_plot" ? "Commercial" : "Residential";
  if (data.propertyDetails) {
    for (const key of ["bedrooms", "bathrooms", "parking"]) {
      if (form[key] !== undefined) data.propertyDetails[key] = form[key];
    }
  }
  data.insights = Object.fromEntries(INSIGHT_FIELDS.map(key => [key, form[key] ?? stored.insights?.[key] ?? null]));
  return data;
}

/** Allowlist type-specific data, rejecting invalid values and discarding stale sections. */
export function normalizePropertyData(raw, type, subtype, marketingInput = {}) {
  const input = readPropertyData(raw);
  const fail = (error, field = "property_data") => ({ ok: false, error, field });
  if (raw != null && !input) return fail("Property information must be a JSON object.");
  const kind = propertyKind(type, subtype);
  const data = {};
  for (const section of sectionsForKind(kind)) {
    const source = input?.[section];
    if (source != null && (!readPropertyData(source) || typeof source === "string")) return fail(`${section} must be an object.`);
    data[section] = {};
    const definitions = [...fieldsForSection(section, kind)];
    if (section === "propertyDetails") definitions.push(field("bedrooms", "Bedrooms"), field("bathrooms", "Bathrooms"), field("parking", "Parking", ["Yes", "No", "1 car", "2 cars", "3 cars", "4 cars+"]));
    for (const { key, label, options } of definitions) {
      const value = section === "commercialInfo" && key === "commercialType" && !Object.hasOwn(source || {}, key)
        ? source?.type : source?.[key];
      if (value == null || value === "") continue;
      const name = `${section}.${key}`;
      if (key === "amenities" && Array.isArray(value)) {
        if (value.some(v => typeof v !== "string" || !v.trim() || v.length > 500 || hasHtmlOrScript(v))) return fail("Amenities must contain valid text without HTML (up to 500 characters each).", name);
        if (value.length) data[section][key] = [...new Set(value.map(v => v.trim()))];
      } else if (key === "roadWidth") {
        if (!/^(\d+(?:\.\d{1,2})?)(?: ft\+?)?$/.test(String(value)) || parseFloat(value) > 999999.99) return fail("Road Width must be a non-negative number up to 999999.99 (ft).", name);
        data[section][key] = String(value).includes(" ft") ? value : `${Number(value)} ft`;
      } else if (numericFields.has(key)) {
        if (!["string", "number"].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value)) || Number(value) > (counts.has(key) ? 99 : 999999.99) || (counts.has(key) && !Number.isInteger(Number(value)))) return fail(`${label} must be a valid non-negative ${counts.has(key) ? "whole number up to 99" : "number up to 999999.99"}.`, name);
        data[section][key] = Number(value);
      } else {
        if (typeof value !== "string" || value.length > 500 || hasHtmlOrScript(value)) return fail(`${label} must be text up to 500 characters without HTML.`, name);
        if (options && !options.includes(value)) return fail(`Choose a valid ${label.toLowerCase()}.`, name);
        if (value.trim()) data[section][key] = value.trim();
      }
    }
  }
  if (input?.insights != null && (!readPropertyData(input.insights) || typeof input.insights === "string")) return fail("Insights must be an object.");
  const marketing = normalizeMarketingSections({ ...input?.insights, ...marketingInput });
  if (!marketing.ok) return marketing;
  data.insights = marketing.data;
  return { ok: true, data: raw == null ? null : data, marketing: marketing.data };
}

/** Old edit clients can save without dropping JSON; existing insight columns stay synchronized. */
export function preparePropertyDataSave(body, type, subtype, current = null) {
  const raw = Object.hasOwn(body, "property_data") ? body.property_data : current;
  const marketing = Object.fromEntries(INSIGHT_FIELDS.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
  return normalizePropertyData(raw, type, subtype, marketing);
}

/** Preserve data outside the edit form's fields, while allowing fields to be cleared. */
export function mergeEditedPropertyData(current, next, type, subtype, classificationChanged = false) {
  if (next == null) return next;
  const previous = readPropertyData(current) || {};
  const merged = { ...previous };
  if (classificationChanged) {
    for (const section of Object.keys(PROPERTY_DATA_FIELDS)) delete merged[section];
  }
  for (const [section, values] of Object.entries(next)) {
    const retained = { ...readPropertyData(merged[section]) };
    const keys = section === "insights" ? INSIGHT_FIELDS : fieldsForSection(section, propertyKind(type, subtype)).map(field => field.key);
    if (section === "propertyDetails") keys.push("bedrooms", "bathrooms", "parking");
    if (section === "commercialInfo") keys.push("type");
    for (const key of keys) delete retained[key];
    merged[section] = { ...retained, ...values };
  }
  return merged;
}
