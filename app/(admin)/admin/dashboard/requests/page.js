"use client";

import { useEffect, useState } from "react";
import RequestActions from "./ApproveButton";
import LogoutButton from "@/components/LogoutButton";

import styles from "./page.module.css";

const statusMeta = {
  pending: {
    label: "Pending approval",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fcd34d",
  },
  approved: {
    label: "Approved",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#86efac",
  },
  revoked: {
    label: "Revoked",
    color: "#b91c1c",
    bg: "#fef2f2",
    border: "#fda4af",
  },
  rejected: {
    label: "Rejected",
    color: "#7c2d12",
    bg: "#fff7ed",
    border: "#fdba74",
  },
};

const ITEMS_PER_PAGE = 5;

export default function RequestsPage() {
  const [allRequests, setAllRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch requests on mount
  useEffect(() => {
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

    fetchRequests();
  }, []);

  // Apply filters whenever filter state changes
  useEffect(() => {
    let filtered = [...allRequests];

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    // Filter by search term (name, email, estate)
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
    setCurrentPage(1); // Reset to first page when filters change
  }, [allRequests, statusFilter, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentRequests = filteredRequests.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className={styles.requestsPage}>
      <div className={styles.requestsShell}>
        <div className={styles.requestsHeader}>
          <div className={styles.requestsTopRow}>
            <div className={styles.requestsBadge}>Agent access requests</div>
            <LogoutButton
              callbackUrl="/admin/login"
              label="Logout"
              className={styles.logoutButton}
            />
          </div>
          <h1 className={styles.requestsHeading}>Manage access requests</h1>
          <p className={styles.requestsDescription}>
            Review each request, approve access, or revoke it at any time.
            Revoked agents will no longer be able to log in or access their
            public page.
          </p>
        </div>

        {/* Filters Section */}
        <div className={styles.filtersSection}>
          <div className={styles.filterGroup}>
            <label htmlFor="search-filter" className={styles.filterLabel}>
              Search
            </label>
            <input
              id="search-filter"
              type="text"
              placeholder="Search by name, email, or estate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="status-filter" className={styles.filterLabel}>
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.statusSelect}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="revoked">Revoked</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className={styles.filterStats}>
            Showing <strong>{currentRequests.length}</strong> of{" "}
            <strong>{filteredRequests.length}</strong> requests
          </div>
        </div>

        {/* Requests Grid */}
        {loading ? (
          <div className={styles.emptyState}>Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className={styles.emptyState}>
            {allRequests.length === 0
              ? "No requests yet."
              : "No requests match your filters."}
          </div>
        ) : (
          <>
            <div className={styles.requestGrid}>
              {currentRequests.map((request) => {
                const meta = statusMeta[request.status] || statusMeta.pending;
                return (
                  <div key={request.id} className={styles.requestCard}>
                    <div className={styles.requestHeader}>
                      <div>
                        <h2 className={styles.requestTitle}>
                          {request.full_name}
                        </h2>
                        <p className={styles.requestEmail}>{request.email}</p>
                      </div>
                      <div
                        className={styles.requestStatus}
                        style={{
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                        }}
                      >
                        {meta.label}
                      </div>
                    </div>

                    <div className={styles.requestMeta}>
                      <div className={styles.requestMetaItem}>
                        <span className={styles.requestMetaItemLabel}>
                          Estate
                        </span>
                        <span className={styles.requestMetaItemValue}>
                          {request.estate_name}
                        </span>
                      </div>
                      <div className={styles.requestMetaItem}>
                        <span className={styles.requestMetaItemLabel}>
                          Phone
                        </span>
                        <span className={styles.requestMetaItemValue}>
                          {request.phone || "—"}
                        </span>
                      </div>
                      <div className={styles.requestMetaItem}>
                        <span className={styles.requestMetaItemLabel}>
                          Submitted
                        </span>
                        <span className={styles.requestMetaItemValue}>
                          {new Date(request.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {request.message ? (
                      <p className={styles.requestMessage}>{request.message}</p>
                    ) : (
                      <p className={styles.requestMessageEmpty}>
                        No additional message.
                      </p>
                    )}

                    <RequestActions request={request} />
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className={styles.paginationContainer}>
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className={styles.paginationButton}
                  aria-label="Previous page"
                >
                  ← Previous
                </button>

                <div className={styles.paginationInfo}>
                  Page <strong>{currentPage}</strong> of{" "}
                  <strong>{totalPages}</strong>
                </div>

                <div className={styles.pageButtons}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`${styles.pageButton} ${
                          page === currentPage ? styles.pageButtonActive : ""
                        }`}
                        aria-label={`Go to page ${page}`}
                        aria-current={page === currentPage ? "page" : undefined}
                      >
                        {page}
                      </button>
                    ),
                  )}
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className={styles.paginationButton}
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
