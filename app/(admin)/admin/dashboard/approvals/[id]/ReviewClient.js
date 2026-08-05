"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import Pagination from "@/components/Pagination";
import RejectPropertyDialog from "@/components/admin/RejectPropertyDialog";
import styles from "@/components/admin/adminUi.module.css";

const STATUS_BADGE = {
  approved: "badgeSuccess",
  pending_approval: "badgePending",
  rejected: "badgeDanger",
  sold: "badgeInfo",
};

const IMAGES_PER_PAGE = 10;

function formatPrice(value) {
  if (value == null || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function statusLabel(status) {
  return String(status || "draft").replace(/_/g, " ");
}

function InfoRow({ label, children }) {
  return (
    <div className={styles.infoRow}>
      <p className={styles.infoLabel}>{label}</p>
      <p className={styles.infoValue}>{children ?? "—"}</p>
    </div>
  );
}

export default function ReviewClient({ propertyId }) {
  const router = useRouter();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [imagePage, setImagePage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load this property.");
      setProperty(data.property);
    } catch (err) {
      setError(err.message || "Could not load this property.");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(status, rejectedReason) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, rejected_reason: rejectedReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update this property.");
        return;
      }
      setRejecting(false);
      router.push("/admin/dashboard/approvals");
      router.refresh();
    } catch {
      setError("Could not update this property.");
    } finally {
      setBusy(false);
    }
  }

  const images = property?.images || [];
  const imageTotalPages = Math.max(1, Math.ceil(images.length / IMAGES_PER_PAGE));

  useEffect(() => {
    setImagePage(1);
  }, [propertyId]);

  useEffect(() => {
    setImagePage((page) => Math.min(page, imageTotalPages));
  }, [imageTotalPages]);

  if (loading) {
    return <div className={styles.loading}>Loading property…</div>;
  }

  if (!property) {
    return (
      <div>
        <Link href="/admin/dashboard/approvals" className={styles.backLink}>
          ← Back to approvals
        </Link>
        <div className={styles.emptyState}>{error || "Property not found."}</div>
      </div>
    );
  }

  const isPending = property.status === "pending_approval";
  const safeImagePage = Math.min(imagePage, imageTotalPages);
  const imageStart =
    images.length === 0 ? 0 : (safeImagePage - 1) * IMAGES_PER_PAGE;
  const imageEnd = Math.min(imageStart + IMAGES_PER_PAGE, images.length);
  const pageImages = images.slice(imageStart, imageEnd);

  return (
    <div>
      <Link href="/admin/dashboard/approvals" className={styles.backLink}>
        ← Back to approvals
      </Link>

      {error ? <p className={styles.noticeDanger}>{error}</p> : null}

      <div className={styles.reviewGrid}>
        <div>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{property.title}</h2>
              <span
                className={`${styles.badge} ${
                  styles[STATUS_BADGE[property.status] || "badgeMuted"]
                }`}
              >
                {statusLabel(property.status)}
              </span>
            </div>
            <div className={styles.panelBody}>
              {images.length === 0 ? (
                <p className={styles.empty}>This listing has no images.</p>
              ) : (
                <>
                  <div className={styles.galleryMeta}>
                    <p className={styles.galleryCount}>
                      {images.length}{" "}
                      {images.length === 1 ? "image" : "images"}
                    </p>
                    {images.length > IMAGES_PER_PAGE ? (
                      <p className={styles.galleryRange}>
                        Showing {imageStart + 1}-{imageEnd} of {images.length}
                      </p>
                    ) : null}
                  </div>
                  <div className={styles.gallery}>
                    {pageImages.map((image, pageIndex) => {
                      const absoluteIndex = imageStart + pageIndex;
                      return (
                        <button
                          key={image.id}
                          type="button"
                          className={styles.galleryItem}
                          aria-label={`Open preview: ${image.image_title || image.category_label || "Property image"}`}
                          onClick={() => {
                            setPreviewIndex(absoluteIndex);
                            setPreviewOpen(true);
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.image_url}
                            alt={image.image_title || ""}
                          />
                          {image.is_featured ? (
                            <span className={styles.galleryFlag}>Featured</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <Pagination
                    currentPage={safeImagePage}
                    totalPages={imageTotalPages}
                    onPageChange={setImagePage}
                    showNav={false}
                    ariaLabel="Property images pagination"
                  />
                </>
              )}
            </div>
          </section>

          {property.video_url ? (
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Walkthrough video</h2>
              </div>
              <div className={styles.panelBody}>
                <video
                  className={styles.reviewVideo}
                  controls
                  preload="metadata"
                  src={property.video_url}
                >
                  Your browser does not support this video format.
                </video>
              </div>
            </section>
          ) : null}

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Description</h2>
            </div>
            <div className={styles.panelBody}>
              {property.description ? (
                <p className={styles.descriptionText}>{property.description}</p>
              ) : (
                <p className={styles.empty}>No description provided.</p>
              )}
            </div>
          </section>
        </div>

        <div>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Review</h2>
            </div>
            <div className={styles.panelBody}>
              {isPending ? (
                <div className={styles.reviewActions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSuccess}`}
                    disabled={busy}
                    onClick={() => review("approved")}
                  >
                    {busy ? "Working…" : "Approve Property"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    disabled={busy}
                    onClick={() => setRejecting(true)}
                  >
                    Reject Property
                  </button>
                </div>
              ) : (
                <p className={styles.empty}>
                  This listing is not awaiting review.
                </p>
              )}

              {property.rejected_reason ? (
                <>
                  <InfoRow label="Rejection reason">
                    {property.rejected_reason}
                  </InfoRow>
                  <InfoRow label="Rejected">
                    {formatDateTime(property.rejected_at)}
                    {property.rejected_by ? ` · ${property.rejected_by}` : ""}
                  </InfoRow>
                </>
              ) : null}
              {property.approved_at ? (
                <InfoRow label="Approved">
                  {formatDateTime(property.approved_at)}
                  {property.approved_by ? ` · ${property.approved_by}` : ""}
                </InfoRow>
              ) : null}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Property</h2>
            </div>
            <div className={styles.panelBody}>
              <InfoRow label="Price">{formatPrice(property.price)}</InfoRow>
              <InfoRow label="Location">{property.location}</InfoRow>
              <InfoRow label="Size">
                {property.size_value
                  ? `${property.size_value} ${property.size_unit}`
                  : null}
              </InfoRow>
              <InfoRow label="Images">{images.length}</InfoRow>
              <InfoRow label="Submitted">
                {formatDateTime(property.submitted_at)}
              </InfoRow>
              <InfoRow label="Created">
                {formatDateTime(property.created_at)}
              </InfoRow>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Agent</h2>
              <Link
                href={`/admin/dashboard/properties?agent=${encodeURIComponent(
                  property.estate_name || "",
                )}`}
                className={styles.panelLink}
              >
                All listings
              </Link>
            </div>
            <div className={styles.panelBody}>
              <InfoRow label="Name">{property.agent_name}</InfoRow>
              <InfoRow label="Company">{property.agent_company}</InfoRow>
              <InfoRow label="Estate">/re/{property.estate_name}</InfoRow>
              <InfoRow label="Email">
                {property.agent_email ? (
                  <a href={`mailto:${property.agent_email}`} className={styles.mailLink}>
                    {property.agent_email}
                  </a>
                ) : null}
              </InfoRow>
              <InfoRow label="Phone">{property.agent_phone}</InfoRow>
              <InfoRow label="Account">{property.agent_status}</InfoRow>
            </div>
          </section>
        </div>
      </div>

      {rejecting ? (
        <RejectPropertyDialog
          propertyTitle={property.title}
          busy={busy}
          onCancel={() => setRejecting(false)}
          onConfirm={(reason) => review("rejected", reason)}
        />
      ) : null}

      <ImagePreviewModal
        images={images}
        currentIndex={previewIndex}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
