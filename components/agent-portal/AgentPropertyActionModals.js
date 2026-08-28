"use client";

import PropertyLinksModal from "@/components/agent-portal/PropertyLinksModal";
import ui from "@/components/agent-portal/portal.module.css";

export default function AgentPropertyActionModals({
  username,
  propertyToDelete,
  propertyToCancelApproval,
  propertyForLinks,
  busyId,
  onCloseDelete,
  onConfirmDelete,
  onCloseCancelApproval,
  onConfirmCancelApproval,
  onCloseLinks,
}) {
  return (
    <>
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
