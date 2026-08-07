"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/components/admin/adminUi.module.css";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return formatDate(value);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-PK");
}

function trendClass(trend) {
  if (trend > 0) return styles.statTrendUp;
  if (trend < 0) return styles.statTrendDown;
  return styles.statTrendFlat;
}

function trendLabel(trend, upText, flatText) {
  if (trend > 0) return `↑ ${trend}% ${upText}`;
  if (trend < 0) return `↓ ${Math.abs(trend)}% vs last month`;
  return flatText;
}

/**
 * Cumulative growth chart. Plots running platform totals rather than
 * per-month counts so the trend stays readable on a young dataset.
 */
function GrowthChart({ properties, agents }) {
  const width = 640;
  const height = 230;
  const padX = 34;
  const padY = 22;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2 - 18;

  const max = Math.max(
    ...properties.map((p) => p.cumulative),
    ...agents.map((a) => a.cumulative),
    1,
  );

  const toPoints = (series) =>
    series.map((item, index) => ({
      ...item,
      x:
        series.length === 1
          ? width / 2
          : padX + (index / (series.length - 1)) * innerW,
      y: padY + innerH - (item.cumulative / max) * innerH,
    }));

  const propPoints = toPoints(properties);
  const agentPoints = toPoints(agents);

  const area = [
    `${propPoints[0].x},${padY + innerH}`,
    ...propPoints.map((p) => `${p.x},${p.y}`),
    `${propPoints[propPoints.length - 1].x},${padY + innerH}`,
  ].join(" ");

  return (
    <>
      <svg
        className={styles.lineChart}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Platform growth: total properties and agents over time"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padY + innerH - t * innerH;
          return (
            <g key={t}>
              <line
                className={styles.lineChartGrid}
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
              />
              <text
                className={styles.lineChartLabel}
                x={padX - 8}
                y={y + 4}
                textAnchor="end"
              >
                {Math.round(max * t)}
              </text>
            </g>
          );
        })}

        <polygon className={styles.lineChartArea} points={area} />
        <polyline
          className={styles.lineChartLine}
          points={propPoints.map((p) => `${p.x},${p.y}`).join(" ")}
        />
        <polyline
          className={styles.lineChartLineAlt}
          points={agentPoints.map((p) => `${p.x},${p.y}`).join(" ")}
        />

        {propPoints.map((point) => (
          <circle
            key={`p-${point.month}`}
            className={styles.lineChartDot}
            cx={point.x}
            cy={point.y}
            r={4}
          />
        ))}
        {agentPoints.map((point) => (
          <circle
            key={`a-${point.month}`}
            className={styles.lineChartDotAlt}
            cx={point.x}
            cy={point.y}
            r={3.5}
          />
        ))}
        {propPoints.map((point) => (
          <text
            key={`l-${point.month}`}
            className={styles.lineChartLabel}
            x={point.x}
            y={height - 4}
            textAnchor="middle"
          >
            {point.label}
          </text>
        ))}
      </svg>
      <div className={styles.chartLegend}>
        <span className={styles.chartLegendItem}>
          <span
            className={styles.donutSwatch}
            style={{ background: "var(--gold-deep)" }}
          />
          Properties
        </span>
        <span className={styles.chartLegendItem}>
          <span
            className={styles.donutSwatch}
            style={{ background: "#2563eb" }}
          />
          Agents
        </span>
      </div>
    </>
  );
}

function buildAttentionItems({
  approvalQueue = [],
  recentPending = [],
  blockedAgents = [],
}) {
  return [
    ...approvalQueue.map((item) => ({
      id: `prop-${item.id}`,
      type: "Property Approval",
      name: item.title,
      subtitle: item.location || item.agent_name || "Property submission",
      status: "Pending",
      statusTone: "pending",
      href: `/admin/dashboard/approvals/${item.id}`,
      actionLabel: "Review",
    })),
    ...recentPending.map((req) => ({
      id: `req-${req.id}`,
      type: "Agent Request",
      name: req.full_name,
      subtitle: req.estate_name || req.email || "Agent access request",
      status: "Pending",
      statusTone: "pending",
      href: "/admin/dashboard/requests",
      actionLabel: "Review",
    })),
    ...blockedAgents.map((agent) => ({
      id: `blocked-${agent.id}`,
      type: "Blocked Agent",
      name: agent.full_name,
      subtitle: agent.estate_name
        ? `/re/${agent.estate_name}`
        : "Requires follow-up",
      status: "Action Needed",
      statusTone: "danger",
      href: "/admin/dashboard/agents",
      actionLabel: "View",
    })),
  ];
}

function normalizeActivity(item) {
  if (item.user && item.action) {
    return {
      id: item.id,
      time: item.at,
      user: item.user,
      action: item.action,
      details: item.details || item.detail || "—",
      href: item.href && item.href !== "#" ? item.href : null,
      type: item.type || null,
    };
  }

  const typeMap = {
    property: {
      user: item.title?.replace(/\s+added a new property$/i, "") || "Agent",
      action: "Added Property",
    },
    property_added: {
      user: item.title?.replace(/\s+added a new property$/i, "") || "Agent",
      action: "Added Property",
    },
    property_approved: {
      user: "Superadmin",
      action: "Approved Property",
    },
    property_rejected: {
      user: "Superadmin",
      action: "Rejected Property",
    },
    agent: {
      user: item.detail?.split(" · ")[0] || "Agent",
      action: "Agent Registered",
    },
    agent_joined: {
      user: item.detail?.split(" · ")[0] || "Agent",
      action: "Agent Registered",
    },
    agent_blocked: {
      user: "Superadmin",
      action: "Blocked Agent",
    },
    agent_request: {
      user: item.detail?.split(" · ")[0] || "Applicant",
      action: "Access Request",
    },
  };

  const mapped = typeMap[item.type] || {
    user: "System",
    action: item.title || "Activity",
  };

  return {
    id: item.id,
    time: item.at,
    user: mapped.user,
    action: mapped.action,
    details: item.details || item.detail || "—",
    href: item.href && item.href !== "#" ? item.href : null,
    type: item.type || null,
  };
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
    return (
      <div className={styles.emptyState}>{error || "No data available."}</div>
    );
  }

  const {
    stats,
    propertyGrowth = [],
    agentGrowth = [],
    approvalQueue = [],
    activity = [],
    recentPending = [],
    recentAgents = [],
    blockedAgents = [],
  } = data;

  const attentionItems = buildAttentionItems({
    approvalQueue,
    recentPending,
    blockedAgents,
  });
  const activityRows = activity.map(normalizeActivity);

  const STAT_CARDS = [
    {
      label: "Total Properties",
      value: stats.totalProperties,
      hint: `${stats.soldProperties} sold · ${stats.draftProperties} draft`,
      trend: stats.propertiesTrend,
      trendText: trendLabel(
        stats.propertiesTrend,
        "this month",
        `${stats.propertiesThisMonth} added this month`,
      ),
      href: "/admin/dashboard/properties",
    },
    {
      label: "Active Agents",
      value: stats.activeAgents,
      hint: `${stats.disabledAgents} disabled · ${stats.blockedAgents || 0} blocked`,
      trend: stats.agentsTrend,
      trendText: trendLabel(
        stats.agentsTrend,
        "vs last month",
        `${stats.agentsThisMonth} new this month`,
      ),
      href: "/admin/dashboard/agents",
    },
    {
      label: "Pending Property Approvals",
      value: stats.pendingProperties,
      hint: stats.pendingProperties > 0 ? "Needs attention" : "Queue is clear",
      trend: null,
      trendText:
        stats.pendingProperties > 0
          ? "Review submissions"
          : "No pending listings",
      href: "/admin/dashboard/approvals",
    },
    {
      label: "Live Property Listings",
      value: stats.activeProperties,
      hint: "Publicly visible",
      trend: null,
      trendText: "Approved and live",
      href: "/admin/dashboard/properties?status=approved",
    },
    {
      label: "Pending Agent Requests",
      value: stats.pendingRequests,
      hint: "Awaiting your review",
      trend: null,
      trendText:
        stats.pendingRequests > 0 ? "Needs attention" : "No pending requests",
      href: "/admin/dashboard/requests",
    },
  ];

  return (
    <div className={styles.opsStack}>
      <div className={styles.gridStats}>
        {STAT_CARDS.map((card) => (
          <Link
            key={card.href + card.label}
            href={card.href}
            className={`${styles.statCard} ${styles.statCardLink}`}
          >
            <p className={styles.statLabel}>{card.label}</p>
            <p className={styles.statValue}>{formatNumber(card.value)}</p>
            <p className={styles.statHint}>{card.hint}</p>
            <p
              className={`${styles.statTrend} ${
                card.trend == null
                  ? styles.statTrendFlat
                  : trendClass(card.trend)
              }`}
            >
              {card.trendText}
            </p>
          </Link>
        ))}
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Needs Attention</h2>
          <Link href="/admin/dashboard/approvals" className={styles.panelLink}>
            View all
          </Link>
        </div>
        {attentionItems.length === 0 ? (
          <div className={styles.allClear}>
            <span className={styles.allClearIcon} aria-hidden="true">
              ✓
            </span>
            <div>
              <p className={styles.listPrimary}>You are all caught up</p>
              <p className={styles.listSecondary}>
                No listings, agent requests, or blocked agents need action.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {attentionItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={styles.typeLabel}>{item.type}</span>
                    </td>
                    <td>
                      <p className={styles.listPrimary}>{item.name}</p>
                      <p className={styles.listSecondary}>{item.subtitle}</p>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          item.statusTone === "danger"
                            ? styles.badgeDanger
                            : styles.badgePending
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <Link href={item.href} className={styles.panelLink}>
                        {item.actionLabel}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className={styles.opsRow}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Platform Growth</h2>
            <span className={styles.listSecondary}>
              Running totals · last 6 months
            </span>
          </div>
          <div className={styles.chartBody}>
            {propertyGrowth.length === 0 ? (
              <p className={styles.chartEmpty}>No growth data yet.</p>
            ) : (
              <GrowthChart properties={propertyGrowth} agents={agentGrowth} />
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent Agents</h2>
            <Link href="/admin/dashboard/agents" className={styles.panelLink}>
              View All
            </Link>
          </div>
          {recentAgents.length === 0 ? (
            <p className={styles.empty}>No agents yet.</p>
          ) : (
            <div className={styles.panelBody}>
              {recentAgents.map((agent) => (
                <div key={agent.id} className={styles.listRow}>
                  <div>
                    <p className={styles.listPrimary}>{agent.full_name}</p>
                    <p className={styles.listSecondary}>
                      Joined: {formatDate(agent.created_at)}
                    </p>
                    <p className={styles.listSecondary}>
                      Properties:{" "}
                      {formatNumber(
                        agent.total_properties ?? agent.property_count ?? 0,
                      )}
                    </p>
                  </div>
                  <span
                    className={`${styles.badge} ${
                      agent.status === "active"
                        ? styles.badgeSuccess
                        : agent.status === "blocked"
                          ? styles.badgeDanger
                          : styles.badgePending
                    }`}
                  >
                    {agent.status === "active"
                      ? "Active"
                      : agent.status === "blocked"
                        ? "Blocked"
                        : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Recent Activities</h2>
          <Link href="/admin/dashboard/logs" className={styles.panelLink}>
            View all
          </Link>
        </div>
        {activityRows.length === 0 ? (
          <p className={styles.empty}>No recent platform activity.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={styles.activityTime}>
                        {formatRelativeTime(row.time)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.listPrimary}>{row.user}</span>
                    </td>
                    <td>{row.action}</td>
                    <td>
                      {row.href ? (
                        <a
                          href={row.href}
                          className={`${styles.listSecondary} ${styles.activityDetailLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {row.details}
                        </a>
                      ) : (
                        <span className={styles.listSecondary}>
                          {row.details}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
