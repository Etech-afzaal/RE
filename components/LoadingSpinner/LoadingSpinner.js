import styles from "./LoadingSpinner.module.css";

/**
 * Premium full-page / panel loading indicator for the RE marketplace.
 * Pure UI — does not affect routing, auth, or data flow.
 */
export default function LoadingSpinner({
  label = "Loading",
  hint = null,
  fullPage = true,
  exiting = false,
  className = "",
}) {
  const rootClass = [
    fullPage ? styles.overlay : styles.panel,
    fullPage && exiting ? styles.overlayExit : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className={styles.center}>
        <div className={styles.ringWrap} aria-hidden="true">
          <span className={styles.ring} />
          <span className={styles.ringSpin} />
          <span className={styles.core}>
            <span className={styles.coreDot} />
          </span>
        </div>
        <p className={styles.label}>{label}</p>
        {hint ? <p className={styles.subLabel}>{hint}</p> : null}
      </div>
    </div>
  );
}
