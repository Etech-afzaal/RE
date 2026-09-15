"use client";

import {
  propertyMediaCategoryGroups,
  imageCategoryLabel,
  OTHER_CATEGORY_VALUE,
  imageCategoryCustomValue,
  imageCategorySelectValue,
} from "@/lib/imageCategories";

/**
 * Room/area picker for a property image.
 * Selecting "Other" reveals a custom label field; the stored value becomes
 * that custom label (not the literal "other"), so galleries can show it.
 */
export default function ImageCategorySelect({
  value,
  onChange,
  disabled = false,
  className,
  style,
  inputClassName,
  inputStyle,
  ariaLabel = "Image category",
  propertyKind,
  mediaType = "image",
}) {
  const groups = propertyMediaCategoryGroups(propertyKind, mediaType);
  const options = groups.flatMap(group => group.categories);
  const selectedOption = options.find(option => option.value === value);
  const selectValue = selectedOption ? selectedOption.value : imageCategorySelectValue(value);
  // Keep legacy categories selected when switching types; never rewrite media.
  const retainedOption = selectValue && selectValue !== OTHER_CATEGORY_VALUE &&
    !options.some(option => option.value === selectValue);
  const customValue = imageCategoryCustomValue(value);
  const showCustom = selectValue === OTHER_CATEGORY_VALUE;

  return (
    <div style={{ display: "grid", gap: "0.45rem" }}>
      <select
        className={className}
        style={style}
        aria-label={ariaLabel}
        value={selectValue}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value || "";
          if (!next) {
            onChange(null);
            return;
          }
          if (next === OTHER_CATEGORY_VALUE) {
            // Keep an existing custom label when re-selecting Other.
            onChange(customValue || OTHER_CATEGORY_VALUE);
            return;
          }
          onChange(next);
        }}
      >
        <option value="">Select category</option>
        {retainedOption ? <option value={selectValue}>{imageCategoryLabel(value)}</option> : null}
        {groups.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {group.categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {showCustom ? (
        <input
          type="text"
          className={inputClassName || className}
          style={inputStyle || style}
          disabled={disabled}
          maxLength={60}
          placeholder="Custom category (e.g. Swimming Pool)"
          aria-label="Custom category"
          value={customValue}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next.trim() ? next : OTHER_CATEGORY_VALUE);
          }}
        />
      ) : null}
    </div>
  );
}
