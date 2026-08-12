"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, CircleCheck } from "lucide-react";
import ActionMenu from "@/components/ActionMenu";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import { getPropertyUrl } from "@/lib/propertySlug";
import { formatPropertyPrice } from "@/lib/formatPrice";
import styles from "@/components/admin/adminUi.module.css";

const ITEMS_PER_PAGE = 8;

function formatPrice(value, currency) {
  return formatPropertyPrice(value, currency, {
    fallback: "—",
    variant: "admin",
  });
}

const statusClass = {
  approved: "badgeSuccess",
  active: "badgeSuccess",
  sold: "badgeInfo",
  draft: "badgeMuted",
  pending_approval: "badgePending",
  rejected: "badgeDanger",
  hidden: "badgeMuted",
};

const STATUS_FILTER_OPTIONS = [
  "all",
  "approved",
  "pending_approval",
  "rejected",
  "sold",
  "draft",
  "hidden",
];

/** API returns approved listings as "active"; dropdown uses "approved". */
function normalizePropertyStatus(status) {
  if (status === "active") return "approved";
  return status || "draft";
}

function statusLabel(status) {
  return String(normalizePropertyStatus(status)).replace(/_/g, " ");
}

function isLiveProperty(status) {
  return normalizePropertyStatus(status) === "approved";
}

function parseStatusFilter(value) {
  if (value === "active") return "approved";
  return STATUS_FILTER_OPTIONS.includes(value) ? value : "all";
}

export default function AdminPropertiesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const agentFromQuery = searchParams.get("agent") || "";
  const statusFromQuery = searchParams.get("status") || "";
  const initialStatus = parseStatusFilter(statusFromQuery);

  const [properties, setProperties] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [agentFilter, setAgentFilter] = useState(agentFromQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [previewImages, setPreviewImages] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setAgentFilter(agentFromQuery);
  }, [agentFromQuery]);

  useEffect(() => {
    setStatusFilter(parseStatusFilter(statusFromQuery));
  }, [statusFromQuery]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/properties", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setProperties(data.properties || []);
        }
      } catch {
        setError("Failed to load properties.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function syncFiltersToUrl({ status, agent }) {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (agent) params.set("agent", agent);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleStatusChange(value) {
    setStatusFilter(value);
    syncFiltersToUrl({ status: value, agent: agentFilter });
  }

  function handleAgentChange(value) {
    setAgentFilter(value);
    syncFiltersToUrl({ status: statusFilter, agent: value });
  }

  const estates = useMemo(() => {
    const set = new Set(properties.map((p) => p.estate_name).filter(Boolean));
    return Array.from(set).sort();
  }, [properties]);

  const filtered = useMemo(() => {
    let next = [...properties];
    if (statusFilter !== "all") {
      next = next.filter(
        (p) => normalizePropertyStatus(p.status) === statusFilter,
      );
    }
    if (agentFilter) {
      next = next.filter((p) => p.estate_name === agentFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      next = next.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(term) ||
          (p.location || "").toLowerCase().includes(term) ||
          (p.agent_name || "").toLowerCase().includes(term) ||
          (p.estate_name || "").toLowerCase().includes(term),
      );
    }
    return next;
  }, [properties, statusFilter, agentFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, agentFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  async function updateStatus(property, status) {
    setBusyId(property.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not update listing.");
        return;
      }
      setProperties((prev) =>
        prev.map((p) => (p.id === property.id ? { ...p, status } : p)),
      );
    } catch {
      setError("Could not update listing.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label htmlFor="prop-search">Search</label>
          <input
            id="prop-search"
            className={styles.input}
            placeholder="Title, location, agent…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.field} style={{ maxWidth: 180 }}>
          <label htmlFor="prop-status">Status</label>
          <select
            id="prop-status"
            className={styles.select}
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="pending_approval">Pending approval</option>
            <option value="rejected">Rejected</option>
            <option value="sold">Sold</option>
            <option value="draft">Draft</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
        <div className={styles.field} style={{ maxWidth: 200 }}>
          <label htmlFor="prop-agent">Estate</label>
          <select
            id="prop-agent"
            className={styles.select}
            value={agentFilter}
            onChange={(e) => handleAgentChange(e.target.value)}
          >
            <option value="">All estates</option>
            {estates.map((estate) => (
              <option key={estate} value={estate}>
                {estate}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.toolbarMeta}>
          <strong>{filtered.length}</strong> listings
        </div>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {loading ? (
        <LoadingSpinner
          fullPage={false}
          label="Loading"
          hint="Fetching properties…"
        />
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>No properties match your filters.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Agent</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Updated</th>
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
                                  image_title: property.title,
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
                            {property.size_value
                              ? ` · ${property.size_value} ${property.size_unit}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Agent">
                      <p className={styles.listPrimary}>{property.agent_name}</p>
                      {property.estate_name ? (
                        <a
                          href={`/re/${encodeURIComponent(property.estate_name)}`}
                          className={styles.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          /re/{property.estate_name}
                        </a>
                      ) : (
                        <p className={styles.listSecondary}>—</p>
                      )}
                    </td>
                    <td data-label="Price">
                      {formatPrice(property.price, property.price_currency)}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`${styles.badge} ${
                          styles[statusClass[property.status] || "badgeMuted"]
                        }`}
                      >
                        {statusLabel(property.status)}
                      </span>
                    </td>
                    <td data-label="Updated">
                      {new Date(
                        property.updated_at || property.created_at,
                      ).toLocaleDateString()}
                    </td>
                    <td data-label="Actions">
                      <ActionMenu
                        ariaLabel={`Actions for ${property.title}`}
                        onView={
                          isLiveProperty(property.status)
                            ? () =>
                                window.open(
                                  getPropertyUrl(property),
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              : undefined
                        }
                        additionalActions={
                          property.status === "pending_approval"
                            ? [{ label: "Review submission", icon: CircleCheck, onSelect: () => router.push(`/admin/dashboard/approvals/${property.id}`) }]
                            : [
                                ...(property.status !== "draft"
                                  ? [{ label: "Unpublish", icon: Archive, destructive: true, disabled: busyId === property.id, onSelect: () => updateStatus(property, "draft") }]
                                  : [{ label: "Publish", icon: CircleCheck, disabled: busyId === property.id, onSelect: () => updateStatus(property, "active") }]),
                              ]
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      <ImagePreviewModal
        images={previewImages}
        currentIndex={0}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
