/**
 * Predefined labels for property images, so a listing gallery can say which
 * part of the property each photo shows.
 *
 * Values are stored verbatim in property_images.category. Rows uploaded before
 * this feature have NULL and are treated as "other" / "Uncategorized".
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

const CATEGORY_VALUES = new Set(IMAGE_CATEGORIES.map((c) => c.value));
const CATEGORY_LABELS = new Map(
  IMAGE_CATEGORIES.map((c) => [c.value, c.label]),
);

export function isValidImageCategory(value) {
  return CATEGORY_VALUES.has(String(value || "").trim().toLowerCase());
}

/**
 * Coerce any incoming value to a stored category.
 * @returns {string|null} a known category, or null to leave the row uncategorized
 */
export function normalizeImageCategory(value) {
  const candidate = String(value ?? "").trim().toLowerCase();
  if (!candidate) return null;
  return CATEGORY_VALUES.has(candidate) ? candidate : null;
}

/** Human-readable label for display. Uncategorized rows never render blank. */
export function imageCategoryLabel(value) {
  const candidate = String(value ?? "").trim().toLowerCase();
  if (!candidate) return UNCATEGORIZED_LABEL;
  return CATEGORY_LABELS.get(candidate) || UNCATEGORIZED_LABEL;
}

/**
 * Group images by category for room-by-room browsing.
 * Order follows IMAGE_CATEGORY_GROUPS so output is stable, and uncategorized
 * images are collected last rather than dropped.
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

  return IMAGE_CATEGORIES.filter((c) => buckets.has(c.value)).map((c) => ({
    category: c.value,
    label: c.value === DEFAULT_IMAGE_CATEGORY ? UNCATEGORIZED_LABEL : c.label,
    images: buckets.get(c.value),
  }));
}
