"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ActionMenu from "@/components/ActionMenu";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import Pagination from "@/components/Pagination";
import ui from "@/components/agent-portal/portal.module.css";

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "pending_approval", label: "Pending Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "sold", label: "Sold" },
];

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `PKR ${n.toLocaleString("en-PK")}`;
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

export default function AgentPropertiesPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/adminarea`;
  const [tab, setTab] = useState("all");
  const [properties, setProperties] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProperties, setTotalProperties] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [success, setSuccess] = useState("");
  const [previewImages, setPreviewImages] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
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

      <div className={ui.panel} ref={propertiesSectionRef}>
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
          <p className={ui.empty}>Loading…</p>
        ) : properties.length === 0 ? (
          <p className={ui.empty}>No properties in this tab.</p>
        ) : (
          <>
            <p className={ui.paginationCount}>
              Showing {(currentPage - 1) * 10 + 1}&ndash;
              {Math.min(currentPage * 10, totalProperties)} of {totalProperties}{" "}
              properties
            </p>
            <div className={ui.tableWrap}>
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
                  const note = statusNote(property.status);
                  const addedOn = formatAddedDate(property.created_at);
                  return (
                    <tr key={property.id}>
                      <td>
                        <div className={ui.propCell}>
                          {image ? (
                            <button
                              type="button"
                              className={ui.thumbButton}
                              aria-label={`Preview image for ${property.title}`}
                              onClick={() => {
                                const gallery =
                                  property.images?.length > 0
                                    ? property.images
                                    : [{ image_url: image, image_title: property.title }];
                                setPreviewImages(gallery);
                                setPreviewOpen(true);
                              }}
                            >
                              <Image
                                src={image}
                                alt=""
                                width={52}
                                height={52}
                                className={ui.thumb}
                              />
                            </button>
                          ) : (
                            <div className={ui.thumbFallback}>P</div>
                          )}
                          <div>
                            <p className={ui.propTitle}>{property.title}</p>
                            {addedOn ? (
                              <p className={ui.propMeta}>Added: {addedOn}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>{property.location || "—"}</td>
                      <td>
                        <span
                          className={`${ui.badge} ${statusClass(property.status)}`}
                        >
                          {statusLabel(property.status)}
                        </span>
                        {note ? <p className={ui.statusNote}>{note}</p> : null}
                        {isRejected ? (
                          <p className={`${ui.statusNote} ${ui.statusNoteRejected}`}>
                            <span className={ui.reasonLabel}>Reason: </span>
                            {property.rejected_reason ||
                              "No reason was recorded."}
                          </p>
                        ) : null}
                      </td>
                      <td>{formatPrice(property.price)}</td>
                      <td>
                        <ActionMenu
                          ariaLabel={`Actions for ${property.title}`}
                          onView={
                            property.status === "approved"
                              ? () => window.open(`/re/${encodeURIComponent(username)}/${property.id}`, "_blank", "noopener,noreferrer")
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
                          additionalActions={
                            property.status === "draft" || isRejected
                              ? [{ label: isRejected ? "Resubmit" : "Submit For Approval", onSelect: () => submitForApproval(property), disabled: busyId === property.id }]
                              : []
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={changePage}
            />
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

      <ImagePreviewModal
        images={previewImages}
        currentIndex={0}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </AgentPortalShell>
  );
}
