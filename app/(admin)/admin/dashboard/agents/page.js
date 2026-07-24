"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/components/admin/adminUi.module.css";

const ITEMS_PER_PAGE = 8;

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/agents", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
        }
      } catch {
        setError("Failed to load agents.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    let next = [...agents];
    if (statusFilter !== "all") {
      next = next.filter((a) => a.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      next = next.filter(
        (a) =>
          a.full_name.toLowerCase().includes(term) ||
          a.email.toLowerCase().includes(term) ||
          a.estate_name.toLowerCase().includes(term),
      );
    }
    setFiltered(next);
    setCurrentPage(1);
  }, [agents, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  async function setAgentStatus(agent, status) {
    setBusyId(agent.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not update agent.");
        return;
      }
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, status } : a)),
      );
    } catch {
      setError("Could not update agent.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label htmlFor="agent-search">Search</label>
          <input
            id="agent-search"
            className={styles.input}
            placeholder="Name, email, or estate…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.field} style={{ maxWidth: 220 }}>
          <label htmlFor="agent-status">Status</label>
          <select
            id="agent-status"
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className={styles.toolbarMeta}>
          <strong>{filtered.length}</strong> agents
        </div>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {loading ? (
        <div className={styles.loading}>Loading agents…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>No agents match your filters.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Estate</th>
                  <th>Listings</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <p className={styles.listPrimary}>{agent.full_name}</p>
                      <p className={styles.listSecondary}>{agent.email}</p>
                    </td>
                    <td>
                      <Link
                        href={`/re/${agent.estate_name}`}
                        className={styles.link}
                        target="_blank"
                      >
                        /re/{agent.estate_name}
                      </Link>
                    </td>
                    <td>
                      {agent.active_count} active
                      <span className={styles.listSecondary}>
                        {" "}
                        · {agent.property_count} total
                      </span>
                    </td>
                    <td>{new Date(agent.created_at).toLocaleDateString()}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          agent.status === "active"
                            ? styles.badgeSuccess
                            : styles.badgeDanger
                        }`}
                      >
                        {agent.status === "active" ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <Link
                          href={`/admin/dashboard/properties?agent=${encodeURIComponent(agent.estate_name)}`}
                          className={styles.btn}
                        >
                          Properties
                        </Link>
                        {agent.status === "active" ? (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger}`}
                            disabled={busyId === agent.id}
                            onClick={() => setAgentStatus(agent, "disabled")}
                          >
                            {busyId === agent.id ? "…" : "Disable"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnSuccess}`}
                            disabled={busyId === agent.id}
                            onClick={() => setAgentStatus(agent, "active")}
                          >
                            {busyId === agent.id ? "…" : "Enable"}
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
