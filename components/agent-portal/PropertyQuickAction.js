"use client";

import styles from "./PropertyQuickAction.module.css";

/**
 * Icon-only row action with CSS tooltip (no extra library).
 */
export default function PropertyQuickAction({
  icon: Icon,
  tooltip,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className={styles.button}
      data-tooltip={tooltip}
      aria-label={tooltip}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
