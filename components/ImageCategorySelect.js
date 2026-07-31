"use client";

import { IMAGE_CATEGORY_GROUPS } from "@/lib/imageCategories";

/**
 * Room/area picker for a property image. Rendered by both the portal screens
 * (CSS modules) and the older agent screens (inline styles), so the caller
 * supplies its own className/style.
 */
export default function ImageCategorySelect({
  value,
  onChange,
  disabled = false,
  className,
  style,
  ariaLabel = "Image category",
}) {
  return (
    <select
      className={className}
      style={style}
      aria-label={ariaLabel}
      value={value || ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">Uncategorized</option>
      {IMAGE_CATEGORY_GROUPS.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
