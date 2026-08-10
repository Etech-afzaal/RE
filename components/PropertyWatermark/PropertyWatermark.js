import styles from "./PropertyWatermark.module.css";

/**
 * Dynamic property branding watermark overlay.
 * Used for video players/thumbnails (baked watermarks cover images at upload).
 * Text comes from agent company/estate branding — never hardcode.
 */
export default function PropertyWatermark({
  text,
  compact = false,
  className = "",
}) {
  const label = String(text || "").trim();
  if (!label) return null;

  return (
    <span
      className={[
        styles.watermark,
        compact ? styles.compact : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <span className={styles.shadow}>{label}</span>
      <span className={styles.label}>{label}</span>
    </span>
  );
}
