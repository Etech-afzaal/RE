"use client";

import { Trash2 } from "lucide-react";
import PropertyLinksModal from "@/components/agent-portal/PropertyLinksModal";
import ui from "@/components/agent-portal/portal.module.css";

export default function AgentPropertyActionModals({
  username,
  successPopup,
  propertyToDelete,
  propertyToCancelApproval,
  propertyStatusChange,
  propertyVisibilityChange,
  propertyForLinks,
  busyId,
  onCloseDelete,
  onConfirmDelete,
  onCloseCancelApproval,
  onConfirmCancelApproval,
  onClosePropertyStatusChange,
  onConfirmPropertyStatusChange,
  onClosePropertyVisibilityChange,
  onConfirmPropertyVisibilityChange,
  onCloseLinks,
}) {
  const successMessage =
    typeof successPopup === "string" ? successPopup : successPopup?.message;
  const showSuccessIcon =
    typeof successPopup === "string" || successPopup?.showIcon !== false;

  return (
    <>
      {successPopup ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div className={`${ui.dialog} ${ui.dialogSuccess}`} role="status" aria-live="polite" aria-labelledby="property-action-success-title">
            {showSuccessIcon ? (
              <div className={ui.dialogSuccessIcon} aria-hidden="true">✓</div>
            ) : (
              <div className={ui.dialogSuccessIcon} aria-hidden="true">
                <Trash2 size={20} strokeWidth={2.2} />
              </div>
            )}
            <h2 id="property-action-success-title" className={ui.dialogTitle}>{successMessage}</h2>
          </div>
        </div>
      ) : null}
      {propertyToDelete ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div
            className={ui.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-property-title"
            aria-describedby="delete-property-description"
          >
            <h2 id="delete-property-title" className={ui.dialogTitle}>
              Delete Property?
            </h2>
            <p id="delete-property-description" className={ui.dialogText}>
              This action cannot be undone. This will permanently delete
              &ldquo;{propertyToDelete.title}&rdquo; and all associated data.
            </p>
            <div className={ui.dialogActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={busyId === propertyToDelete.id}
                onClick={onCloseDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className={ui.btnDanger}
                disabled={busyId === propertyToDelete.id}
                onClick={onConfirmDelete}
              >
                {busyId === propertyToDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {propertyToCancelApproval ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div
            className={ui.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-approval-title"
            aria-describedby="cancel-approval-description"
          >
            <h2 id="cancel-approval-title" className={ui.dialogTitle}>
              Cancel approval request?
            </h2>
            <p id="cancel-approval-description" className={ui.dialogText}>
              This property will return to Draft and can be edited and submitted
              again.
            </p>
            <div className={ui.dialogActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={busyId === propertyToCancelApproval.id}
                onClick={onCloseCancelApproval}
              >
                Keep Request
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={busyId === propertyToCancelApproval.id}
                onClick={onConfirmCancelApproval}
              >
                {busyId === propertyToCancelApproval.id
                  ? "Cancelling…"
                  : "Cancel Approval Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {propertyStatusChange ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div className={ui.dialog} role="dialog" aria-modal="true" aria-labelledby="property-status-change-title">
            <h2 id="property-status-change-title" className={ui.dialogTitle}>
              {propertyStatusChange.status === "under_contract"
                ? "Mark as Under Contract?"
                : propertyStatusChange.property.status === "sold"
                  ? "Mark as Unsold?"
                : "Mark as Published?"}
            </h2>
            <p className={ui.dialogText}>
              {propertyStatusChange.status === "under_contract"
                ? "This property will be marked as Under Contract and will no longer appear as an available property."
                : propertyStatusChange.property.status === "sold"
                  ? "This property will return to the active market as Published."
                : "This property will return to the active market as Published."}
            </p>
            <div className={ui.dialogActions}>
              <button type="button" className={ui.btnGhost} disabled={busyId === propertyStatusChange.property.id} onClick={onClosePropertyStatusChange}>Cancel</button>
              <button type="button" className={ui.btnPrimary} disabled={busyId === propertyStatusChange.property.id} onClick={onConfirmPropertyStatusChange}>
                {busyId === propertyStatusChange.property.id
                  ? "Updating…"
                  : propertyStatusChange.status === "under_contract"
                    ? "Mark as Under Contract"
                    : propertyStatusChange.property.status === "sold"
                      ? "Mark as Unsold"
                    : "Mark as Published"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {propertyVisibilityChange ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div
            className={ui.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="property-visibility-title"
            aria-describedby="property-visibility-description"
          >
            <h2 id="property-visibility-title" className={ui.dialogTitle}>
              {propertyVisibilityChange.isHidden ? "Hide from Listing?" : "Unhide Property?"}
            </h2>
            <p id="property-visibility-description" className={ui.dialogText}>
              {propertyVisibilityChange.isHidden
                ? "This property will be hidden from public listings. Its current status will remain unchanged."
                : "This property will become visible on your public listings again. Its current status will remain unchanged."}
            </p>
            <div className={ui.dialogActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={busyId === propertyVisibilityChange.property.id}
                onClick={onClosePropertyVisibilityChange}
              >
                Cancel
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={busyId === propertyVisibilityChange.property.id}
                onClick={onConfirmPropertyVisibilityChange}
              >
                {busyId === propertyVisibilityChange.property.id
                  ? "Updating…"
                  : propertyVisibilityChange.isHidden
                    ? "Hide from Listing"
                    : "Unhide"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {propertyForLinks ? (
        <PropertyLinksModal
          property={propertyForLinks}
          username={username}
          onClose={onCloseLinks}
        />
      ) : null}
    </>
  );
}
