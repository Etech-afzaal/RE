"use client";

import { useEffect, useState } from "react";
import RequestActions from "./ApproveButton";
import styles from "@/components/admin/adminUi.module.css";

const ITEMS_PER_PAGE = 6;

const statusMeta = {
  pending: { label: "Pending", className: "badgePending" },
  approved: { label: "Approved", className: "badgeSuccess" },
  revoked: { label: "Revoked", className: "badgeDanger" },
  rejected: { label: "Rejected", className: "badgeMuted" },
};

export default function RequestsPage() {
  const [allRequests, setAllRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchRequests() {
    try {
      const response = await fetch("/api/admin/requests", {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAllRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    let filtered = [...allRequests];

    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.full_name.toLowerCase().includes(term) ||
          req.email.toLowerCase().includes(term) ||
          req.estate_name.toLowerCase().includes(term),
      );
    }

    setFilteredRequests(filtered);
    setCurrentPage(1);
  }, [allRequests, statusFilter, searchTerm]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / ITEMS_PER_PAGE),
  );
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRequests = filteredRequests.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  function handleStatusChange(requestId, nextStatus) {
    setAllRequests((prev) =>
      prev.map((req) =>
        req.id === requestId ? { ...req, status: nextStatus } : req,
      ),
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label htmlFor="search-filter">Search</label>
          <input
            id="search-filter"
            type="text"
            placeholder="Name, email, or estate…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.field} style={{ maxWidth: 220 }}>
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.select}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="revoked">Revoked</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className={styles.toolbarMeta}>
          Showing <strong>{currentRequests.length}</strong> of{" "}
          <strong>{filteredRequests.length}</strong>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading requests…</div>
      ) : filteredRequests.length === 0 ? (
        <div className={styles.emptyState}>
          {allRequests.length === 0
            ? "No requests yet."
            : "No requests match your filters."}
        </div>
      ) : (
        <>
          <div className={styles.cardGrid}>
            {currentRequests.map((request) => {
              const meta = statusMeta[request.status] || statusMeta.pending;
              return (
                <article key={request.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <h2 className={styles.cardTitle}>{request.full_name}</h2>
                      <p className={styles.cardEmail}>
                        <a href={`mailto:${request.email}`} className={styles.mailLink}>
                          {request.email}
                        </a>
                      </p>
                    </div>
                    <span className={`${styles.badge} ${styles[meta.className]}`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <label>Estate</label>
                      <span className={styles.mono}>{request.estate_name}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <label>Phone</label>
                      <span>{request.phone || "—"}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <label>Submitted</label>
                      <span>
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {request.message ? (
                    <p className={styles.message}>{request.message}</p>
                  ) : (
                    <p className={styles.messageEmpty}>No additional message.</p>
                  )}

                  <RequestActions
                    request={request}
                    onStatusChange={handleStatusChange}
                  />
                </article>
              );
            })}
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
