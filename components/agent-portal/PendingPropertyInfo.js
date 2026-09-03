"use client";

import { useEffect, useId, useState } from "react";
import { Info } from "lucide-react";
import ui from "@/components/agent-portal/portal.module.css";

export default function PendingPropertyInfo({ propertyTitle }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={ui.pendingInfoButton}
        aria-label={`Why ${propertyTitle || "this property"} is pending`}
        title="About pending approval"
        onClick={() => setOpen(true)}
      >
        <Info size={16} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className={ui.dialogBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className={ui.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
          >
            <div className={ui.pendingDialogIcon} aria-hidden="true">
              <Info size={22} />
            </div>
            <h2 id={headingId} className={ui.dialogTitle}>
              Property Under Review
            </h2>
            <p id={descriptionId} className={ui.dialogText}>
              We are reviewing your property request. It will appear on your
              public website after approval. We will update its status once the
              review is complete.
            </p>
            <div className={ui.dialogActions}>
              <button type="button" className={ui.btnPrimary} onClick={() => setOpen(false)} autoFocus>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
