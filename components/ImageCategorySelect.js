"use client";

import styles from "./ImageCategorySelect.module.css";
import {
  propertyMediaCategoryGroups,
  IMAGE_CATEGORIES,
  OTHER_CATEGORY_VALUE,
  MAX_CUSTOM_CATEGORY_LENGTH,
} from "@/lib/imageCategories";

/** Editable text with the original grouped native category dropdown. */
export default function ImageCategorySelect({
  value, onChange, disabled = false, className, style, inputClassName,
  inputStyle, ariaLabel = "Image category", propertyKind, mediaType = "image",
}) {
  const groups = propertyMediaCategoryGroups(propertyKind, mediaType)
    .map(group => ({ ...group, categories: group.categories.filter(option => option.value !== OTHER_CATEGORY_VALUE) }))
    .filter(group => group.categories.length);
  const options = groups.flatMap(group => group.categories);
  const known = IMAGE_CATEGORIES.find(option => option.value === value);
  const displayValue = value === OTHER_CATEGORY_VALUE ? "" : known?.label ?? value ?? "";

  return (
    <div className={styles.control} style={{ position: "relative" }}>
      <select
        className={className}
        style={{ ...style, color: "transparent" }}
        aria-label={`${ariaLabel} options`}
        disabled={disabled}
        value={options.some(option => option.value === value) ? value : ""}
        onChange={event => onChange(event.target.value || null)}
      >
        <option value="" style={{ color: "var(--ink, #1a1a1a)" }}>Select category</option>
        {groups.map(group => (
          <optgroup key={group.id} label={group.label} style={{ color: "var(--ink, #1a1a1a)" }}>
            {group.categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </optgroup>
        ))}
      </select>
      <input
        type="text"
        className={inputClassName || className}
        style={{ ...(inputStyle || style), position: "absolute", top: 0, left: 0, width: "calc(100% - 2.5rem)", background: "transparent", borderColor: "transparent", paddingRight: "0.25rem" }}
        aria-label={ariaLabel}
        placeholder="Select or type category"
        value={displayValue}
        disabled={disabled}
        maxLength={MAX_CUSTOM_CATEGORY_LENGTH}
        autoComplete="off"
        onChange={event => {
          const text = event.target.value;
          const match = [...options, ...IMAGE_CATEGORIES].find(option =>
            option.label.toLowerCase() === text.toLowerCase() ||
            option.value.toLowerCase() === text.toLowerCase()
          );
          onChange(text.trim() ? match?.value ?? text : null);
        }}
      />
    </div>
  );
}
