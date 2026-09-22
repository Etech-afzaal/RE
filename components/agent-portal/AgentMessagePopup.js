"use client";

import { useEffect } from "react";
import ui from "@/components/agent-portal/portal.module.css";

export default function AgentMessagePopup({ message, tone = "success", onClose }) {
  useEffect(() => {
    if (!message || tone !== "success") return undefined;
    const timer = window.setTimeout(() => onClose?.(), 2000);
    return () => window.clearTimeout(timer);
  }, [message, tone, onClose]);

  if (!message) return null;

  return (
    <div className={ui.dialogBackdrop} role="presentation">
      <div
        className={`${ui.dialog} ${tone === "success" ? ui.dialogSuccess : ""}`}
        role={tone === "success" ? "status" : "alertdialog"}
        aria-live="polite"
        aria-modal="true"
        aria-labelledby="agent-message-popup-title"
      >
        {tone === "success" ? (
          <div className={ui.dialogSuccessIcon} aria-hidden="true">
            ✓
          </div>
        ) : null}
        <h2 id="agent-message-popup-title" className={ui.dialogTitle}>
          {message}
        </h2>
        {tone !== "success" ? (
          <div className={ui.dialogActions}>
            <button type="button" className={ui.btnPrimary} onClick={onClose}>
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
