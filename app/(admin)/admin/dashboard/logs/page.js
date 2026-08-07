"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import styles from "@/components/admin/adminUi.module.css";

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "properties", label: "Properties" },
  { value: "agents", label: "Agents" },
  { value: "authentication", label: "Authentication" },
  { value: "system", label: "System" },
];

const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function entityLabel(type) {
  if (!type) return "—";
  if (type === "signup_request") return "Signup request";
  return String(type).replace(/_/g, " ");
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, rangeFilter]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: "25",
        type: typeFilter,
        range: rangeFilter,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/logs?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Could not load audit logs.");
        setLogs([]);
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(
        data.pagination || {
          page: currentPage,
          pageSize: 25,
          total: 0,
          totalPages: 1,
        },
      );
    } catch {
      setError("Could not load audit logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, typeFilter, rangeFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label htmlFor="logs-search">Search</label>
          <input
            id="logs-search"
            className={styles.input}
            placeholder="User, description, entity…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.field} style={{ maxWidth: 220 }}>
          <label htmlFor="logs-type">Activity type</label>
          <select
            id="logs-type"
            className={styles.select}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field} style={{ maxWidth: 220 }}>
          <label htmlFor="logs-range">Date</label>
          <select
            id="logs-range"
            className={styles.select}
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value)}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.toolbarMeta}>
          <strong>{pagination.total}</strong> events
        </div>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {loading ? (
        <div className={styles.loading}>Loading logs…</div>
      ) : logs.length === 0 ? (
        <div className={styles.emptyState}>
          No audit events match your filters.
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Activity</th>
                  <th>Entity</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td data-label="Date">
                      <span className={styles.activityTime}>
                        {formatDate(log.createdAt)}
                      </span>
                    </td>
                    <td data-label="User">
                      <span className={styles.listPrimary}>{log.user}</span>
                    </td>
                    <td data-label="Activity">{log.activity}</td>
                    <td data-label="Entity">
                      <span className={styles.typeLabel}>
                        {entityLabel(log.entityType)}
                      </span>
                      {log.entityId != null ? (
                        <span className={styles.listSecondary}>
                          {" "}
                          #{log.entityId}
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Description">
                      <span className={styles.listSecondary}>
                        {log.description}
                      </span>
                    </td>
                    <td data-label="Actions">
                      {log.href ? (
                        <a
                          href={log.href}
                          className={styles.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                        </a>
                      ) : (
                        <span className={styles.listSecondary}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setCurrentPage}
            ariaLabel="Audit logs pagination"
          />
        </>
      )}
    </div>
  );
}
