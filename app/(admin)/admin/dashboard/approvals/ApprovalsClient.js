"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Eye } from "lucide-react";
import ActionMenu from "@/components/ActionMenu";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import LoadingSpinner from "@/components/LoadingSpinner";
import RejectPropertyDialog from "@/components/admin/RejectPropertyDialog";
import { formatPropertyPrice } from "@/lib/formatPrice";
import { getPropertyUrl } from "@/lib/propertySlug";
import styles from "@/components/admin/adminUi.module.css";

const ITEMS_PER_PAGE = 8;

function formatPrice(value, currency) {
  return formatPropertyPrice(value, currency, {
    fallback: "—",
    variant: "admin",
  });
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function ApprovalsClient() {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewImages, setPreviewImages] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/properties?status=pending_approval", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load submissions.");
      setProperties(data.properties || []);
    } catch (err) {
      setError(err.message || "Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(properties.length / ITEMS_PER_PAGE));
  const pageItems = properties.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  async function review(property, status, rejectedReason) {
    setBusyId(property.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/admin/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, rejected_reason: rejectedReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update this submission.");
        return;
      }
      setProperties((prev) => prev.filter((p) => p.id !== property.id));
      setRejecting(null);
      setNotice(
        status === "approved"
          ? `“${property.title}” is approved and now listed publicly.`
          : `“${property.title}” was rejected. The agent can edit and resubmit it.`,
      );
    } catch {
      setError("Could not update this submission.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.toolbarMeta}>
          <strong>{properties.length}</strong>{" "}
          {properties.length === 1 ? "property" : "properties"} waiting for
          review
        </div>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {notice ? (
        <div className={styles.panel} style={{ marginBottom: "1rem" }}>
          <div className={styles.panelBody}>
            <p className={styles.listPrimary}>{notice}</p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingSpinner
          fullPage={false}
          label="Loading"
          hint="Fetching submissions…"
        />
      ) : properties.length === 0 ? (
        <div className={styles.emptyState}>
          Nothing to review. Submitted listings will appear here.
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Agent</th>
                  <th>Price</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((property) => (
                  <tr key={property.id}>
                    <td data-label="Property">
                      <div className={styles.propCell}>
                        {property.image_url ? (
                          <button
                            type="button"
                            className={styles.thumbButton}
                            aria-label={`Preview image for ${property.title}`}
                            onClick={() => {
                              setPreviewImages([
                                {
                                  image_url: property.image_url,
                                  category: null,
                                },
                              ]);
                              setPreviewOpen(true);
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={property.image_url}
                              alt=""
                              className={styles.thumb}
                            />
                          </button>
                        ) : (
                          <div
                            className={`${styles.thumb} ${styles.thumbPlaceholder}`}
                          >
                            N/A
                          </div>
                        )}
                        <div>
                          <a
                            href={getPropertyUrl(property)}
                            className={styles.titleLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {property.title}
                          </a>
                          <p className={styles.listSecondary}>
                            {property.location || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Agent">
                      <p className={styles.listPrimary}>{property.agent_name}</p>
                      <p className={styles.listSecondary}>
                        /re/{property.estate_name}
                      </p>
                    </td>
                    <td data-label="Price">
                      {formatPrice(property.price, property.price_currency)}
                    </td>
                    <td data-label="Submitted">{formatDate(property.submitted_at)}</td>
                    <td data-label="Status">
                      <span className={`${styles.badge} ${styles.badgePending}`}>
                        Pending approval
                      </span>
                    </td>
                    <td data-label="Actions">
                      <ActionMenu
                        ariaLabel={`Review actions for ${property.title}`}
                        additionalActions={[
                          {
                            label: "Open review",
                            icon: Eye,
                            onSelect: () =>
                              router.push(
                                `/admin/dashboard/approvals/${property.id}`,
                              ),
                          },
                          {
                            label: "Approve",
                            icon: CircleCheck,
                            disabled: busyId === property.id,
                            onSelect: () => review(property, "approved"),
                          },
                          {
                            label: "Reject",
                            icon: CircleX,
                            destructive: true,
                            disabled: busyId === property.id,
                            onSelect: () => setRejecting(property),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.btn}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <div className={styles.pageBtns}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      type="button"
                      className={`${styles.pageBtn} ${
                        page === currentPage ? styles.pageBtnActive : ""
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>
              <button
                type="button"
                className={styles.btn}
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {rejecting ? (
        <RejectPropertyDialog
          propertyTitle={rejecting.title}
          busy={busyId === rejecting.id}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => review(rejecting, "rejected", reason)}
        />
      ) : null}

      <ImagePreviewModal
        images={previewImages}
        currentIndex={0}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
