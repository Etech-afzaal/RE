/**
 * Predefined labels for property images, so a listing gallery can say which
 * part of the property each photo shows.
 *
 * Values are stored in property_images.category.
 * - Known rooms use slug values (e.g. "living_room").
 * - Custom "Other" entries store the human label (e.g. "Swimming Pool").
 * - Rows uploaded before this feature have NULL → "Uncategorized".
 */

export const IMAGE_CATEGORY_GROUPS = [
  {
    id: "interior",
    label: "Interior",
    categories: [
      { value: "living_room", label: "Living Room" },
      { value: "master_bedroom", label: "Master Bedroom" },
      { value: "bedroom", label: "Bedroom" },
      { value: "kitchen", label: "Kitchen" },
      { value: "bathroom", label: "Bathroom" },
      { value: "dining_area", label: "Dining Area" },
      { value: "drawing_room", label: "Drawing Room" },
      { value: "tv_lounge", label: "TV Lounge" },
      { value: "study_room", label: "Study Room" },
      { value: "store_room", label: "Store Room" },
    ],
  },
  {
    id: "exterior",
    label: "Exterior",
    categories: [
      { value: "front_view", label: "Front View" },
      { value: "back_view", label: "Back View" },
      { value: "garden", label: "Garden" },
      { value: "terrace", label: "Terrace" },
      { value: "balcony", label: "Balcony" },
      { value: "parking", label: "Parking" },
      { value: "street_view", label: "Street View" },
      { value: "gate", label: "Gate" },
    ],
  },
  {
    id: "other",
    label: "Other",
    categories: [
      { value: "floor_plan", label: "Floor Plan" },
      { value: "location_map", label: "Location Map" },
      { value: "community_view", label: "Community View" },
      { value: "other", label: "Other" },
    ],
  },
];

export const IMAGE_CATEGORIES = IMAGE_CATEGORY_GROUPS.flatMap(
  (group) => group.categories,
);

/** Fallback for images uploaded before categories existed. */
export const DEFAULT_IMAGE_CATEGORY = "other";
export const UNCATEGORIZED_LABEL = "Uncategorized";
export const OTHER_CATEGORY_VALUE = "other";
export const MAX_CUSTOM_CATEGORY_LENGTH = 60;

const CATEGORY_VALUES = new Set(IMAGE_CATEGORIES.map((c) => c.value));
const CATEGORY_LABELS = new Map(
  IMAGE_CATEGORIES.map((c) => [c.value, c.label]),
);

export function isKnownImageCategory(value) {
  return CATEGORY_VALUES.has(String(value || "").trim().toLowerCase());
}

export function isValidImageCategory(value) {
  const normalized = normalizeImageCategory(value);
  if (!normalized) return false;
  // Selecting bare "Other" without a custom label is incomplete for new uploads.
  return true;
}

/**
 * True when the agent picked Other and still needs a custom label
 * (stored value is literally "other" or empty while Other is selected).
 */
export function needsCustomImageCategory(value) {
  const raw = String(value ?? "").trim();
  return !raw || raw.toLowerCase() === OTHER_CATEGORY_VALUE;
}

/**
 * Coerce any incoming value to a stored category.
 * Known slugs stay as slugs; custom labels are kept as trimmed display text.
 * @returns {string|null}
 */
export function normalizeImageCategory(value) {
  const raw = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (CATEGORY_VALUES.has(lower)) return lower;

  const custom = raw.slice(0, MAX_CUSTOM_CATEGORY_LENGTH).trim();
  return custom || null;
}

/** Human-readable label for display. Uncategorized rows never render blank. */
export function imageCategoryLabel(value) {
  const normalized = normalizeImageCategory(value);
  if (!normalized) return UNCATEGORIZED_LABEL;
  if (CATEGORY_LABELS.has(normalized)) {
    return normalized === DEFAULT_IMAGE_CATEGORY
      ? UNCATEGORIZED_LABEL
      : CATEGORY_LABELS.get(normalized);
  }
  return normalized;
}

/**
 * Select-box value for a stored category.
 * Custom labels map to the "Other" option.
 */
export function imageCategorySelectValue(value) {
  const normalized = normalizeImageCategory(value);
  if (!normalized) return "";
  if (CATEGORY_VALUES.has(normalized)) return normalized;
  return OTHER_CATEGORY_VALUE;
}

/**
 * Custom-label field value when Other is active.
 */
export function imageCategoryCustomValue(value) {
  const raw = String(value ?? "");
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === OTHER_CATEGORY_VALUE) return "";
  if (CATEGORY_VALUES.has(trimmed.toLowerCase())) return "";
  return raw;
}

/**
 * Group images by category for room-by-room browsing.
 * Known categories keep their catalog order; custom labels follow after.
 *
 * @param {Array<{category?: string|null}>} images
 * @returns {Array<{ category: string, label: string, images: Array }>}
 */
export function groupImagesByCategory(images = []) {
  const buckets = new Map();

  for (const image of images) {
    const key = normalizeImageCategory(image?.category) || DEFAULT_IMAGE_CATEGORY;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(image);
  }

  const groups = [];

  for (const catalog of IMAGE_CATEGORIES) {
    if (!buckets.has(catalog.value)) continue;
    groups.push({
      category: catalog.value,
      label:
        catalog.value === DEFAULT_IMAGE_CATEGORY
          ? UNCATEGORIZED_LABEL
          : catalog.label,
      images: buckets.get(catalog.value),
    });
    buckets.delete(catalog.value);
  }

  for (const [category, grouped] of buckets.entries()) {
    groups.push({
      category,
      label: imageCategoryLabel(category),
      images: grouped,
    });
  }

  return groups;
}
