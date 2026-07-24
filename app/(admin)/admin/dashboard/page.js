"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/components/admin/adminUi.module.css";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default function AdminOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/stats", { credentials: "include" });
        if (!res.ok) {
          setError("Could not load dashboard stats.");
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Could not load dashboard stats.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className={styles.loading}>Loading overview…</div>;
  }

  if (error || !data) {
    return <div className={styles.emptyState}>{error || "No data available."}</div>;
  }

  const { stats, recentPending, recentAgents } = data;

  return (
    <div>
      <div className={styles.gridStats}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Pending requests</p>
          <p className={styles.statValue}>{stats.pendingRequests}</p>
          <p className={styles.statHint}>Awaiting your review</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Active agents</p>
          <p className={styles.statValue}>{stats.activeAgents}</p>
          <p className={styles.statHint}>
            {stats.disabledAgents} disabled · {stats.totalAgents} total
          </p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Live listings</p>
          <p className={styles.statValue}>{stats.activeProperties}</p>
          <p className={styles.statHint}>Visible on the public site</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>All properties</p>
          <p className={styles.statValue}>{stats.totalProperties}</p>
          <p className={styles.statHint}>
            {stats.soldProperties} sold · {stats.draftProperties} draft
          </p>
        </div>
      </div>

      <div className={styles.panelGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Needs attention</h2>
            <Link href="/admin/dashboard/requests" className={styles.panelLink}>
              View all
            </Link>
          </div>
          <div className={styles.panelBody}>
            {recentPending.length === 0 ? (
              <p className={styles.empty}>No pending access requests.</p>
            ) : (
              recentPending.map((req) => (
                <div key={req.id} className={styles.listRow}>
                  <div>
                    <p className={styles.listPrimary}>{req.full_name}</p>
                    <p className={styles.listSecondary}>
                      {req.estate_name} · {req.email}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`${styles.badge} ${styles.badgePending}`}>
                      Pending
                    </span>
                    <p className={styles.listSecondary} style={{ marginTop: 6 }}>
                      {formatDate(req.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent agents</h2>
            <Link href="/admin/dashboard/agents" className={styles.panelLink}>
              Manage
            </Link>
          </div>
          <div className={styles.panelBody}>
            {recentAgents.length === 0 ? (
              <p className={styles.empty}>No agents yet.</p>
            ) : (
              recentAgents.map((agent) => (
                <div key={agent.id} className={styles.listRow}>
                  <div>
                    <p className={styles.listPrimary}>{agent.full_name}</p>
                    <p className={styles.listSecondary}>
                      /re/{agent.estate_name}
                    </p>
                  </div>
                  <span
                    className={`${styles.badge} ${
                      agent.status === "active"
                        ? styles.badgeSuccess
                        : styles.badgeDanger
                    }`}
                  >
                    {agent.status === "active" ? "Active" : "Disabled"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
