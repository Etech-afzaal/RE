import { readPropertyData, propertyKind, fieldsForSection } from "./propertyData";

export function isFileProperty(property) {
  return property?.property_subtype === "file";
}

/** Public grouping only; never rewrite the stored sale/rent/plot classification. */
export function publicListingSubtype(property) {
  if (isFileProperty(property)) {
    return readPropertyData(property.property_data)?.plotInfo?.plotType === "Commercial"
      ? "commercial_plot" : "residential_plot";
  }
  return property.property_subtype === "shop" ? "commercial" : property.property_subtype;
}

function displayValue(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return "";
}

/** Read only the fields relevant to this property's stored classification. */
export function publicPropertyDetails(property) {
  const data = readPropertyData(property.property_data);
  const kind = propertyKind(property.property_type, property.property_subtype);
  const sections = [];
  const attributes = {};
  let amenities = null;
  if (data) {
    const building = ["house", "apartment", "commercial"].includes(kind);
    const names = building ? ["landInfo", "propertyDetails"] : ["plots", "file"].includes(kind) ? ["plotInfo"] : [];
    const titles = { landInfo: "Land Info", propertyDetails: "Property Details", plotInfo: kind === "file" ? "Plot Info" : "Plot Information" };
    for (const section of names) {
      const source = readPropertyData(data[section]) || {};
      const rows = [];
      if (["landInfo", "plotInfo"].includes(section) && displayValue(property.size_value)) {
        rows.push({ label: "Plot Size", value: `${property.size_value} ${property.size_unit || ""}`.trim() });
      }
      for (const { key, label } of fieldsForSection(section, kind)) {
        if (key === "amenities") continue;
        const value = displayValue(source[key]);
        if (value) rows.push({ label, value });
      }
      if (section === "propertyDetails") {
        for (const [key, label, target] of [["bedrooms", "Bedrooms", "beds"], ["bathrooms", "Bathrooms", "baths"], ["parking", "Parking", "parking"]]) {
          const value = displayValue(source[key]);
          if (value) { rows.push({ label, value }); attributes[target] = source[key]; }
        }
        if (kind === "commercial") {
          const commercial = readPropertyData(data.commercialInfo) || {};
          const value = Object.hasOwn(commercial, "commercialType")
            ? displayValue(commercial.commercialType)
            : displayValue(commercial.type);
          if (value) rows.push({ label: "Commercial Type", value });
        }
      }
      if (Object.hasOwn(source, "amenities") && source.amenities != null) {
        amenities = [...new Set((Array.isArray(source.amenities) ? source.amenities : [source.amenities]).map(displayValue).filter(Boolean))];
      }
      if (rows.length) sections.push({ key: section, title: titles[section], rows });
    }
  }
  return { sections, attributes, amenities };
}

export function publicPropertyInsight(property, field) {
  const insights = readPropertyData(readPropertyData(property.property_data)?.insights);
  let value = insights?.[field];
  if (value == null) return property[field];
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return property[field]; }
  }
  if (!Array.isArray(value)) return property[field];
  if (["why_this_home", "investment_insights"].includes(field)) {
    return value.filter(item => typeof item === "string").map(item => item.trim()).filter(Boolean);
  }
  const titleKey = field === "property_highlights" ? "title" : "name";
  return value.flatMap(item => {
    const source = readPropertyData(item);
    if (!source) return [];
    const title = displayValue(source[titleKey]);
    const description = displayValue(source.description);
    return title || description ? [{ [titleKey]: title, description, icon: displayValue(source.icon) }] : [];
  });
}
