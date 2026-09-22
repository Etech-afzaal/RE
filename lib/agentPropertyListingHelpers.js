import ui from "@/components/agent-portal/portal.module.css";

/** Date-only label from properties.created_at, e.g. "30 Jul 2026". */
export function formatAddedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function statusClass(status) {
  if (status === "approved") return ui.badgeApproved;
  if (status === "pending_approval") return ui.badgePending;
  if (status === "draft") return ui.badgeDraft;
  if (status === "rejected") return ui.badgeRejected;
  if (status === "under_contract") return ui.badgeUnderContract;
  if (status === "sold") return ui.badgeSold;
  return ui.badgeDraft;
}

export function statusLabel(status) {
  if (status === "approved") return "Published";
  if (status === "rejected") return "Requires Updates";
  if (status === "under_contract") return "Under Contract";
  return String(status || "draft").replace(/_/g, " ");
}

/** Short line under the status badge so agents know the listing visibility. */
export function statusNote(status, isHidden = false) {
  if (isHidden) return "Hidden from your website";
  if (["approved", "under_contract", "sold"].includes(status)) {
    return "Published on your website";
  }
  if (status === "pending_approval") return "Waiting for admin review";
  if (status === "draft") return "Not visible to the public";
  if (status === "rejected") return "Update the listing and submit it again";
  return null;
}

export function isFeaturedProperty(property) {
  return (
    property?.is_featured === true ||
    property?.is_featured === 1 ||
    property?.is_featured === "1"
  );
}
