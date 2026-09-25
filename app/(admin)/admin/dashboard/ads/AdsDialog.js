"use client";

import { useEffect, useRef } from "react";
import ui from "@/components/admin/adminUi.module.css";
import styles from "./ads.module.css";

/**
 * Modal used for every Ads Network error/warning. Uses the shared admin
 * dialog styles (same as BlockAgentDialog). Esc or the backdrop closes it.
 *
 *   <AdsDialog title="Couldn't save" message="…" items={["Title is required"]}
 *              onClose={…} action={{ label: "Save as draft", onClick: … }} />
 *
 * For confirmations pass action.tone = "danger" (red button) and a closeLabel.
 */
export default function AdsDialog({
  title,
  message,
  items = [],
  onClose,
  action = null,
  closeLabel,
}) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className={ui.dialogBackdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={ui.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ads-dialog-title"
        aria-describedby="ads-dialog-body"
      >
        <h2 id="ads-dialog-title" className={ui.dialogTitle}>
          {title}
        </h2>
        <div id="ads-dialog-body">
          {message && <p className={ui.dialogText}>{message}</p>}
          {items.length > 0 && (
            <ul className={styles.dialogList}>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        <div className={ui.dialogActions}>
          <button
            ref={closeRef}
            type="button"
            className={`${ui.btn} ${action ? "" : ui.btnPrimary}`}
            onClick={onClose}
          >
            {closeLabel || (action ? "Keep editing" : "OK")}
          </button>
          {action && (
            <button
              type="button"
              className={`${ui.btn} ${action.tone === "danger" ? ui.btnDanger : ui.btnPrimary}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
