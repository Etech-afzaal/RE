"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/admin/adminUi.module.css";
import { validateRejectionReason } from "@/lib/validators/userValidator";

/**
 * Rejection reason prompt. The reason is what the agent sees on their dashboard,
 * so it is mandatory here as well as on the server.
 */
export default function RejectPropertyDialog({
  propertyTitle,
  busy = false,
  onCancel,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, onCancel]);

  function confirm() {
    const reasonCheck = validateRejectionReason(reason);
    if (!reasonCheck.ok) {
      setError(
        reasonCheck.error ||
          "Please tell the agent why this listing was rejected.",
      );
      textareaRef.current?.focus();
      return;
    }
    onConfirm(reasonCheck.value);
  }

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-property-title"
      >
        <h2 id="reject-property-title" className={styles.dialogTitle}>
          Reject Property
        </h2>
        <p className={styles.dialogText}>
          {propertyTitle
            ? `“${propertyTitle}” stays off the public site and the agent can edit and resubmit it.`
            : "The agent can edit and resubmit after seeing your reason."}
        </p>

        <div className={styles.field}>
          <label htmlFor="reject-reason">Reason</label>
          <textarea
            id="reject-reason"
            ref={textareaRef}
            className={styles.textarea}
            value={reason}
            disabled={busy}
            maxLength={500}
            placeholder="e.g. Images are too low quality and the price looks incorrect."
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError("");
            }}
          />
        </div>
        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.btn}
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={busy}
            onClick={confirm}
          >
            {busy ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
