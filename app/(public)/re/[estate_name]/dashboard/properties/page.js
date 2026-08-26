"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Send, Star, StarOff, Undo2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ActionMenu from "@/components/ActionMenu";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import { formatPropertyLocation } from "@/lib/propertyLocation";
import { formatPropertyPrice } from "@/lib/formatPrice";
import { getPropertyUrl } from "@/lib/propertySlug";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "pending_approval", label: "Pending Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "sold", label: "Sold" },
];

function formatPrice(value, currency) {
  return formatPropertyPrice(value, currency, { fallback: "—" });
}

/** Date-only label from properties.created_at, e.g. "30 Jul 2026". */
function formatAddedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusClass(status) {
  if (status === "approved") return ui.badgeApproved;
  if (status === "pending_approval") return ui.badgePending;
  if (status === "draft") return ui.badgeDraft;
  if (status === "rejected") return ui.badgeRejected;
  if (status === "sold") return ui.badgeSold;
  return ui.badgeDraft;
}

function statusLabel(status) {
  return String(status || "draft").replace(/_/g, " ");
}

/** Short line under the status badge so agents know what happens next. */
function statusNote(status) {
  if (status === "approved") return "Listed publicly";
  if (status === "pending_approval") return "Waiting for admin review";
  if (status === "draft") return "Not visible to the public";
  if (status === "hidden") return "Hidden from your public website";
  return null;
}

function isFeaturedProperty(property) {
  return (
    property?.is_featured === true ||
    property?.is_featured === 1 ||
    property?.is_featured === "1"
  );
}

export default function AgentPropertiesPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/dashboard`;
  const [tab, setTab] = useState("all");
  const [properties, setProperties] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProperties, setTotalProperties] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [featuredCount, setFeaturedCount] = useState(0);
  const [featuredLimit, setFeaturedLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [propertyToCancelApproval, setPropertyToCancelApproval] = useState(null);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [success, setSuccess] = useState("");
  const propertiesSectionRef = useRef(null);
  const shouldScrollRef = useRef(false);

  async function load(page = currentPage, selectedTab = tab) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (selectedTab !== "all") params.set("status", selectedTab);
    try {
      const res = await fetch(`/api/properties?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not load properties.");
      }

      setProperties(Array.isArray(data.properties) ? data.properties : []);
      setCurrentPage(data.currentPage || 1);
      setTotalProperties(Number(data.totalProperties) || 0);
      setTotalPages(Number(data.totalPages) || 1);
      setFeaturedCount(Number(data.featuredCount) || 0);
      setFeaturedLimit(Number(data.featuredLimit) || 10);
    } catch (err) {
      setError(err.message || "Could not load properties.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;

    // Dashboard stat cards link here with ?status=<tab>; anything unrecognised
    // falls back to the default "All" tab.
    const requested = new URLSearchParams(window.location.search).get("status");
    const initialTab = TABS.some((item) => item.id === requested)
      ? requested
      : "all";
    setTab(initialTab);
    load(1, initialTab);
  }, [status, router]);

  useEffect(() => {
    if (!loading && shouldScrollRef.current) {
      shouldScrollRef.current = false;
      propertiesSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [loading, properties]);

  function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    shouldScrollRef.current = true;
    load(page);
  }

  function changeTab(nextTab) {
    setTab(nextTab);
    setCurrentPage(1);
    load(1, nextTab);
  }

  async function markAsSold(property) {
    setBusyId(property.id);
    setError("");
    setErrorDetails([]);
    setSuccess("");
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sold" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not mark this property as sold.");
        return;
      }
      setSuccess("Property marked as sold.");
      await load();
    } catch {
      setError("Could not mark this property as sold.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitForApproval(property) {
    setBusyId(property.id);
    setError("");
    setErrorDetails([]);
    setSuccess("");
    try {
      const res = await fetch(`/api/properties/${property.id}/submit`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not submit this property for approval.");
        setErrorDetails(Array.isArray(data.errors) ? data.errors : []);
        return;
      }
      setSuccess("Property submitted for approval.");
      await load();
    } catch {
      setError("Could not submit this property for approval.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelApprovalRequest() {
    if (!propertyToCancelApproval) return;

    const property = propertyToCancelApproval;
    setBusyId(property.id);
    setError("");
    setErrorDetails([]);
    setSuccess("");
    try {
      const res = await fetch(
        `/api/properties/${property.id}/cancel-approval`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error || "Could not cancel this approval request.",
        );
        return;
      }
      setPropertyToCancelApproval(null);
      setSuccess("Approval request cancelled. Property returned to draft.");
      await load();
    } catch {
      setError("Could not cancel this approval request.");
    } finally {
      setBusyId(null);
    }
  }

  async function addToFeatured(property) {
    setBusyId(property.id);
    setError("");
    setErrorDetails([]);
    setSuccess("");
    try {
      const res = await fetch(`/api/properties/${property.id}/featured`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not add this property to featured.");
        return;
      }
      setSuccess(
        data.already_featured
          ? "Property is already featured."
          : "Property added to featured.",
      );
      await load();
    } catch {
      setError("Could not add this property to featured.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeFromFeatured(property) {
    setBusyId(property.id);
    setError("");
    setErrorDetails([]);
    setSuccess("");
    try {
      const res = await fetch(`/api/properties/${property.id}/featured`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove this property from featured.");
        return;
      }
      setSuccess("Property removed from featured.");
      await load();
    } catch {
      setError("Could not remove this property from featured.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProperty() {
    if (!propertyToDelete) return;

    const id = propertyToDelete.id;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not delete this property.");
      }

      const pageAfterDelete =
        properties.length === 1 && currentPage > 1
          ? currentPage - 1
          : currentPage;
      setPropertyToDelete(null);
      setSuccess("Property deleted successfully.");
      await load(pageAfterDelete);
    } catch (err) {
      setError(err.message || "Could not delete this property.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Properties"
      subtitle="Manage drafts, submissions, and live listings"
      action={
        <Link href={`${base}/properties/create`} className={ui.btnPrimary}>
          Add Property
        </Link>
      }
    >
      <div className={ui.tabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${ui.tab} ${tab === item.id ? ui.tabActive : ""}`}
            onClick={() => changeTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className={`${ui.panel} ${
          !loading && properties.length > 0 ? styles.listingPanel : ""
        }`}
        ref={propertiesSectionRef}
      >
        {error ? (
          <div className={ui.error}>
            <p className={ui.noticeTitle}>{error}</p>
            {errorDetails.length > 0 ? (
              <ul className={ui.errorList}>
                {errorDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {success ? <p className={ui.success}>{success}</p> : null}
        {loading ? (
          <LoadingSpinner
            fullPage={false}
            label="Loading"
            hint="Fetching properties…"
          />
        ) : properties.length === 0 ? (
          <p className={ui.empty}>No properties in this tab.</p>
        ) : (
          <>
            <p className={ui.paginationCount}>
              Showing {(currentPage - 1) * 10 + 1}&ndash;
              {Math.min(currentPage * 10, totalProperties)} of {totalProperties}{" "}
              properties
              {" · "}
              Featured: {featuredCount} / {featuredLimit}
            </p>
            <div className={`${ui.tableWrap} ${styles.tableArea}`}>
              <table className={ui.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => {
                  const image =
                    property.featuredImage?.image_url ||
                    property.images?.[0]?.image_url ||
                    null;
                  const editHref = `${base}/properties/${property.id}/edit`;
                  const isPending = property.status === "pending_approval";
                  const isRejected = property.status === "rejected";
                  const featured = isFeaturedProperty(property);
                  const isApproved = property.status === "approved";
                  const linksToEdit = isApproved || isRejected;
                  const note = statusNote(property.status);
                  const addedOn = formatAddedDate(property.created_at);
                  return (
                    <tr key={property.id}>
                      <td data-label="Property">
                        <div className={ui.propCell}>
                          {image ? (
                            linksToEdit ? (
                              <Link
                                href={editHref}
                                className={ui.thumbButton}
                                aria-label={`Edit ${property.title}`}
                              >
                                <Image
                                  src={image}
                                  alt=""
                                  width={52}
                                  height={52}
                                  className={ui.thumb}
                                />
                              </Link>
                            ) : (
                              <Image
                                src={image}
                                alt=""
                                width={52}
                                height={52}
                                className={ui.thumb}
                              />
                            )
                          ) : linksToEdit ? (
                            <Link
                              href={editHref}
                              className={ui.thumbButton}
                              aria-label={`Edit ${property.title}`}
                            >
                              <div className={ui.thumbFallback}>P</div>
                            </Link>
                          ) : (
                            <div className={ui.thumbFallback}>P</div>
                          )}
                          <div>
                            {linksToEdit ? (
                              <Link
                                href={editHref}
                                className={`${ui.propTitle} ${ui.propTitleLink}`}
                              >
                                {property.title}
                              </Link>
                            ) : (
                              <p className={ui.propTitle}>{property.title}</p>
                            )}
                            {addedOn ? (
                              <p className={ui.propMeta}>Added: {addedOn}</p>
                            ) : null}
                            {featured && property.status === "approved" ? (
                              <p className={ui.propMeta}>Featured</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td data-label="Location">{formatPropertyLocation(property) || "—"}</td>
                      <td data-label="Status">
                        <span
                          className={`${ui.badge} ${statusClass(property.status)}`}
                        >
                          {statusLabel(property.status)}
                        </span>
                        {note ? <p className={ui.statusNote}>{note}</p> : null}
                      </td>
                      <td data-label="Price">
                        {formatPrice(property.price, property.price_currency)}
                      </td>
                      <td data-label="Actions">
                        <ActionMenu
                          ariaLabel={`Actions for ${property.title}`}
                          onView={
                            property.status === "approved"
                              ? () =>
                                  window.open(
                                    getPropertyUrl(property, username),
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                              : isPending
                              ? () => router.push(editHref)
                              : undefined
                          }
                          onEdit={isPending ? undefined : () => router.push(editHref)}
                          onDelete={
                            isPending
                              ? undefined
                              : () => {
                                  setError("");
                                  setErrorDetails([]);
                                  setSuccess("");
                                  setPropertyToDelete(property);
                                }
                          }
                          deleteDisabled={busyId === property.id}
                          additionalActions={[
                            ...(property.status === "draft" || isRejected
                              ? [{ label: isRejected ? "Resubmit" : "Submit For Approval", icon: Send, onSelect: () => submitForApproval(property), disabled: busyId === property.id }]
                              : []),
                            ...(isPending
                              ? [{
                                  label: "Cancel Approval Request",
                                  icon: Undo2,
                                  onSelect: () => {
                                    setError("");
                                    setErrorDetails([]);
                                    setSuccess("");
                                    setPropertyToCancelApproval(property);
                                  },
                                  disabled: busyId === property.id,
                                }]
                              : []),
                            ...(property.status === "approved" && !featured
                              ? [{ label: "Add to Featured", icon: Star, onSelect: () => addToFeatured(property), disabled: busyId === property.id }]
                              : []),
                            ...(property.status === "approved" && featured
                              ? [{ label: "Remove from Featured", icon: StarOff, onSelect: () => removeFromFeatured(property), disabled: busyId === property.id }]
                              : []),
                            ...(property.status === "approved" || property.status === "hidden"
                              ? [{ label: "Mark as sold", icon: CircleCheck,  onSelect: () => markAsSold(property), disabled: busyId === property.id }]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
            <div className={styles.paginationSlot}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={changePage}
              />
            </div>
          </>
        )}
      </div>
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
                onClick={() => setPropertyToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={ui.btnDanger}
                disabled={busyId === propertyToDelete.id}
                onClick={deleteProperty}
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
                onClick={() => setPropertyToCancelApproval(null)}
              >
                Keep Request
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={busyId === propertyToCancelApproval.id}
                onClick={cancelApprovalRequest}
              >
                {busyId === propertyToCancelApproval.id
                  ? "Cancelling…"
                  : "Cancel Approval Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AgentPortalShell>
  );
}
