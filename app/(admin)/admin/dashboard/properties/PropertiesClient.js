"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "@/components/admin/adminUi.module.css";

const ITEMS_PER_PAGE = 8;

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

const statusClass = {
  active: "badgeSuccess",
  sold: "badgeInfo",
  draft: "badgeMuted",
};

export default function AdminPropertiesPage() {
  const searchParams = useSearchParams();
  const agentFromQuery = searchParams.get("agent") || "";

  const [properties, setProperties] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState(agentFromQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setAgentFilter(agentFromQuery);
  }, [agentFromQuery]);

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

  const estates = useMemo(() => {
    const set = new Set(properties.map((p) => p.estate_name).filter(Boolean));
    return Array.from(set).sort();
  }, [properties]);

  const filtered = useMemo(() => {
    let next = [...properties];
    if (statusFilter !== "all") {
      next = next.filter((p) => p.status === statusFilter);
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
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className={styles.field} style={{ maxWidth: 200 }}>
          <label htmlFor="prop-agent">Estate</label>
          <select
            id="prop-agent"
            className={styles.select}
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
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
        <div className={styles.loading}>Loading properties…</div>
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
                    <td>
                      <div className={styles.propCell}>
                        {property.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={property.image_url}
                            alt=""
                            className={styles.thumb}
                          />
                        ) : (
                          <div
                            className={`${styles.thumb} ${styles.thumbPlaceholder}`}
                          >
                            N/A
                          </div>
                        )}
                        <div>
                          <p className={styles.listPrimary}>{property.title}</p>
                          <p className={styles.listSecondary}>
                            {property.location || "—"}
                            {property.size_value
                              ? ` · ${property.size_value} ${property.size_unit}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className={styles.listPrimary}>{property.agent_name}</p>
                      <p className={styles.listSecondary}>
                        /re/{property.estate_name}
                      </p>
                    </td>
                    <td>{formatPrice(property.price)}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          styles[statusClass[property.status] || "badgeMuted"]
                        }`}
                      >
                        {property.status}
                      </span>
                    </td>
                    <td>
                      {new Date(
                        property.updated_at || property.created_at,
                      ).toLocaleDateString()}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {property.status === "active" && (
                          <Link
                            href={`/re/${property.estate_name}/${property.id}`}
                            className={styles.btn}
                            target="_blank"
                          >
                            View
                          </Link>
                        )}
                        {property.status !== "draft" && (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger}`}
                            disabled={busyId === property.id}
                            onClick={() => updateStatus(property, "draft")}
                          >
                            Unpublish
                          </button>
                        )}
                        {property.status === "draft" && (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnSuccess}`}
                            disabled={busyId === property.id}
                            onClick={() => updateStatus(property, "active")}
                          >
                            Publish
                          </button>
                        )}
                        {property.status !== "sold" && (
                          <button
                            type="button"
                            className={styles.btn}
                            disabled={busyId === property.id}
                            onClick={() => updateStatus(property, "sold")}
                          >
                            Mark sold
                          </button>
                        )}
                      </div>
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
    </div>
  );
}
