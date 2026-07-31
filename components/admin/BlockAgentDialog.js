"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/admin/adminUi.module.css";

/**
 * Permanent block confirmation. Reason is mandatory — agents see it when they
 * try to sign in, so a vague or empty reason is not allowed.
 */
export default function BlockAgentDialog({
  agentName,
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
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please provide a reason for permanently blocking this agent.");
      textareaRef.current?.focus();
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-agent-title"
      >
        <h2 id="block-agent-title" className={styles.dialogTitle}>
          Permanently Block Agent
        </h2>
        <p className={styles.dialogText}>
          You are about to permanently block
          {agentName ? (
            <>
              : <strong>{agentName}</strong>
            </>
          ) : (
            " this agent"
          )}
          . They will not be able to sign in, and will see this reason on the
          login page.
        </p>

        <div className={styles.field}>
          <label htmlFor="block-reason">Reason for blocking</label>
          <textarea
            id="block-reason"
            ref={textareaRef}
            className={styles.textarea}
            value={reason}
            disabled={busy}
            placeholder="e.g. Fake property listings submitted"
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
            {busy ? "Blocking…" : "Block Agent Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
