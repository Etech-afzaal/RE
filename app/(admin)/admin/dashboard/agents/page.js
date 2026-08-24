"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Building2, CirclePause, CirclePlay } from "lucide-react";
import ActionMenu from "@/components/ActionMenu";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import BlockAgentDialog from "@/components/admin/BlockAgentDialog";
import styles from "@/components/admin/adminUi.module.css";

const ITEMS_PER_PAGE = 8;

/**
 * Estate slug is the brand identity in this product.
 * township-re → Township RE
 */
function companyFromEstate(estateName) {
  return String(estateName || "")
    .trim()
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function statusBadgeClass(status) {
  if (status === "active") return styles.badgeSuccess;
  if (status === "disabled") return styles.badgePending;
  if (status === "blocked") return styles.badgeDanger;
  return styles.badgeMuted;
}

function statusLabel(status) {
  if (status === "active") return "Active";
  if (status === "disabled") return "Disabled";
  if (status === "blocked") return "Blocked";
  return String(status || "unknown").replace(/_/g, " ");
}

export default function AdminAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [blocking, setBlocking] = useState(null);
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
          a.estate_name.toLowerCase().includes(term) ||
          companyFromEstate(a.estate_name).toLowerCase().includes(term),
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

  async function setAgentStatus(agent, status, blockedReason = null) {
    setBusyId(agent.id);
    setError("");
    try {
      const body = { status };
      if (status === "blocked") body.blocked_reason = blockedReason;

      const res = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update agent.");
        return;
      }
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id
            ? {
                ...a,
                status: data.status || status,
                blocked_reason: data.blocked_reason ?? null,
                blocked_at: data.blocked_at ?? null,
                blocked_by: data.blocked_by ?? null,
              }
            : a,
        ),
      );
      setBlocking(null);
    } catch {
      setError("Could not update agent.");
    } finally {
      setBusyId(null);
    }
  }

  function agentActions(agent) {
    const busy = busyId === agent.id;
    const actions = [
      {
        label: "View Properties",
        icon: Building2,
        onSelect: () =>
          router.push(
            `/admin/dashboard/properties?agent=${encodeURIComponent(agent.estate_name)}`,
          ),
      },
    ];

    if (agent.status === "active") {
      actions.push({
        label: "Disable Agent",
        icon: CirclePause,
        disabled: busy,
        onSelect: () => setAgentStatus(agent, "disabled"),
      });
    } else if (agent.status === "disabled") {
      actions.push({
        label: "Enable Agent",
        icon: CirclePlay,
        disabled: busy,
        onSelect: () => setAgentStatus(agent, "active"),
      });
    } else if (agent.status === "blocked") {
      actions.push({
        label: "Unblock Agent",
        icon: CirclePlay,
        disabled: busy,
        onSelect: () => setAgentStatus(agent, "active"),
      });
    }

    if (agent.status !== "blocked") {
      actions.push({
        label: "Permanently Block",
        icon: Ban,
        destructive: true,
        disabled: busy,
        onSelect: () => setBlocking(agent),
      });
    }

    return actions;
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label htmlFor="agent-search">Search</label>
          <input
            id="agent-search"
            className={styles.input}
            placeholder="Name, company, email, or estate…"
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
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <div className={styles.toolbarMeta}>
          <strong>{filtered.length}</strong> agents
        </div>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {loading ? (
        <LoadingSpinner fullPage={false} label="Loading" hint="Fetching agents…" />
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>No agents match your filters.</div>
      ) : (
        <div className={styles.listingPanel}>
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
                    <td data-label="Agent">
                      <p className={styles.listPrimary}>{agent.full_name}</p>
                      <p className={styles.listSecondary}>
                        <a href={`mailto:${agent.email}`} className={styles.mailLink}>
                          {agent.email}
                        </a>
                      </p>
                    </td>
                    <td data-label="Estate">
                      <p className={styles.listPrimary}>
                        {companyFromEstate(agent.estate_name)}
                      </p>
                      <Link
                        href={`/re/${agent.estate_name}`}
                        className={styles.link}
                        target="_blank"
                      >
                        /re/{agent.estate_name}
                      </Link>
                    </td>
                    <td data-label="Listings">
                      {agent.active_count} active
                      <span className={styles.listSecondary}>
                        {" "}
                        · {agent.property_count} total
                      </span>
                    </td>
                    <td data-label="Joined">{new Date(agent.created_at).toLocaleDateString()}</td>
                    <td data-label="Status">
                      <span
                        className={`${styles.badge} ${statusBadgeClass(agent.status)}`}
                      >
                        {statusLabel(agent.status)}
                      </span>
                      {agent.status === "blocked" && agent.blocked_reason ? (
                        <p className={styles.listSecondary} style={{ marginTop: 6 }}>
                          {agent.blocked_reason}
                        </p>
                      ) : null}
                    </td>
                    <td data-label="Actions">
                      <ActionMenu
                        ariaLabel={`Actions for ${agent.full_name}`}
                        additionalActions={agentActions(agent)}
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
        </div>
      )}

      {blocking ? (
        <BlockAgentDialog
          agentName={blocking.full_name}
          busy={busyId === blocking.id}
          onCancel={() => setBlocking(null)}
          onConfirm={(reason) => setAgentStatus(blocking, "blocked", reason)}
        />
      ) : null}
    </div>
  );
}
