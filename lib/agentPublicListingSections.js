import { PROPERTY_SUBTYPES_BY_TYPE } from "@/lib/propertyTaxonomy";

/** Main listing block anchors (agent public website). */
export const LISTING_MAIN_SECTION_IDS = Object.freeze({
  sale: "for-sale",
  rent: "for-rent",
  plot: "plots",
});

const SUBTYPE_SECTION_SUFFIX = Object.freeze({
  house: "houses",
  apartment: "apartments",
  shop: "shops",
  commercial: "commercial",
  residential_plot: "residential",
  commercial_plot: "commercial",
});

/** @param {"sale"|"rent"|"plot"} type */
export function listingMainSectionId(type) {
  return LISTING_MAIN_SECTION_IDS[type] || type;
}

/** @param {"sale"|"rent"|"plot"} type @param {string} subtype */
export function listingSubsectionId(type, subtype) {
  const suffix =
    SUBTYPE_SECTION_SUFFIX[subtype] ||
    String(subtype || "")
      .trim()
      .replace(/_/g, "-");

  if (type === "plot") {
    return `plots-${suffix}`;
  }

  return `for-${type}-${suffix}`;
}

/** Scroll target for navbar main/sub links. */
export function listingScrollTargetId(type, subtype = null) {
  if (subtype) return listingSubsectionId(type, subtype);
  return listingMainSectionId(type);
}

/** Ordered groups rendered on the agent public listings page. */
export const AGENT_PUBLIC_LISTING_GROUPS = Object.freeze([
  {
    type: "sale",
    title: "For Sale",
    subtypes: PROPERTY_SUBTYPES_BY_TYPE.sale,
  },
  {
    type: "rent",
    title: "For Rent",
    subtypes: PROPERTY_SUBTYPES_BY_TYPE.rent,
  },
  {
    type: "plot",
    title: "Plots",
    subtypes: PROPERTY_SUBTYPES_BY_TYPE.plot,
  },
]);

const SUBTYPE_SECTION_TITLES = Object.freeze({
  house: "Houses",
  apartment: "Apartments",
  shop: "Shops",
  commercial: "Commercial",
  residential_plot: "Residential",
  commercial_plot: "Commercial",
});

/** @param {string} subtype */
export function listingSubsectionTitle(subtype) {
  return SUBTYPE_SECTION_TITLES[subtype] || subtype;
}

const SUBTYPE_COUNT_LABELS = Object.freeze({
  house: { one: "house", other: "houses" },
  apartment: { one: "apartment", other: "apartments" },
  shop: { one: "shop", other: "shops" },
  commercial: { one: "commercial", other: "commercial" },
  residential_plot: { one: "plot", other: "plots" },
  commercial_plot: { one: "plot", other: "plots" },
});

/** Count suffix for section header, e.g. "2 apartments", "1 plot". */
export function listingSubsectionCountLabel(subtype, count) {
  const labels = SUBTYPE_COUNT_LABELS[subtype] || {
    one: "listing",
    other: "listings",
  };
  return count === 1 ? labels.one : labels.other;
}
