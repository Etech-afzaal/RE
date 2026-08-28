"use client";

import { CircleCheck, Eye, Link2, Send, SquarePen, Star, StarOff, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import ActionMenu from "@/components/ActionMenu";
import { getPropertyUrl } from "@/lib/propertySlug";
import PropertyQuickAction from "@/components/agent-portal/PropertyQuickAction";
import quickActionStyles from "@/components/agent-portal/PropertyQuickActions.module.css";
import { isFeaturedProperty } from "@/lib/agentPropertyListingHelpers";

export default function PropertyListingActions({
  property,
  username,
  base,
  busyId,
  onMarkSold,
  onSubmitForApproval,
  onAddFeatured,
  onRemoveFeatured,
  onOpenLinks,
  onOpenDelete,
  onOpenCancelApproval,
}) {
  const router = useRouter();
  const editHref = `${base}/properties/${property.id}/edit`;
  const isPending = property.status === "pending_approval";
  const isRejected = property.status === "rejected";
  const featured = isFeaturedProperty(property);
  const isApproved = property.status === "approved";
  const isBusy = busyId === property.id;

  const goToEdit = () => router.push(editHref);
  const showQuickEdit =
    isApproved ||
    isRejected ||
    property.status === "draft" ||
    property.status === "sold" ||
    property.status === "hidden";
  const showQuickLinks = isApproved;
  const showQuickResubmit = isRejected;
  const showQuickPendingView = isPending;

  const menuOnEdit = showQuickEdit ? undefined : goToEdit;
  const menuOnView =
    property.status === "approved"
      ? () =>
          window.open(
            getPropertyUrl(property, username),
            "_blank",
            "noopener,noreferrer",
          )
      : showQuickPendingView
        ? undefined
        : isPending
          ? goToEdit
          : undefined;

  const menuAdditionalActions = [
    ...(property.status === "draft" || isRejected
      ? showQuickResubmit
        ? []
        : [{
            label: isRejected ? "Resubmit" : "Submit For Approval",
            icon: Send,
            onSelect: () => onSubmitForApproval(property),
            disabled: isBusy,
          }]
      : []),
    ...(isPending
      ? [{
          label: "Cancel Approval Request",
          icon: Undo2,
          onSelect: () => onOpenCancelApproval(property),
          disabled: isBusy,
        }]
      : []),
    ...(property.status === "approved" && !featured
      ? [{ label: "Add to Featured", icon: Star, onSelect: () => onAddFeatured(property), disabled: isBusy }]
      : []),
    ...(property.status === "approved" && featured
      ? [{ label: "Remove from Featured", icon: StarOff, onSelect: () => onRemoveFeatured(property), disabled: isBusy }]
      : []),
    ...(property.status === "approved" || property.status === "hidden"
      ? [{ label: "Mark as sold", icon: CircleCheck, onSelect: () => onMarkSold(property), disabled: isBusy }]
      : []),
    ...(showQuickLinks
      ? []
      : isApproved
        ? [{
            label: "Property Links",
            icon: Link2,
            onSelect: () => onOpenLinks(property),
            disabled: isBusy,
          }]
        : []),
  ];

  return (
    <div className={quickActionStyles.actionGroup}>
      {showQuickEdit ? (
        <PropertyQuickAction
          icon={SquarePen}
          tooltip="Edit Property"
          onClick={goToEdit}
          disabled={isBusy}
        />
      ) : null}
      {showQuickLinks ? (
        <PropertyQuickAction
          icon={Link2}
          tooltip="Property Links"
          onClick={() => onOpenLinks(property)}
          disabled={isBusy}
        />
      ) : null}
      {showQuickResubmit ? (
        <PropertyQuickAction
          icon={Send}
          tooltip="Resubmit Property"
          onClick={() => onSubmitForApproval(property)}
          disabled={isBusy}
        />
      ) : null}
      {showQuickPendingView ? (
        <PropertyQuickAction
          icon={Eye}
          tooltip="View Property"
          onClick={goToEdit}
          disabled={isBusy}
        />
      ) : null}
      <ActionMenu
        ariaLabel={`More actions for ${property.title}`}
        triggerTooltip="More Actions"
        onView={menuOnView}
        onEdit={menuOnEdit}
        onDelete={
          isPending
            ? undefined
            : () => onOpenDelete(property)
        }
        deleteDisabled={isBusy}
        additionalActions={menuAdditionalActions}
      />
    </div>
  );
}
