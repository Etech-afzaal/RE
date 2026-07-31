"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/components/admin/adminUi.module.css";

const STATUS_COLORS = {
  approved: "#16a34a",
  pending_approval: "#d97706",
  draft: "#64748b",
  rejected: "#dc2626",
  sold: "#2563eb",
  hidden: "#94a3b8",
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
          Total properties
        </span>
        <span className={styles.chartLegendItem}>
          <span
            className={styles.donutSwatch}
            style={{ background: "#2563eb" }}
          />
          Total agents
        </span>
      </div>
    </>
  );
}

/** Horizontal bars for any { label, value, hint } list. */
function BarList({ items }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className={styles.areaList}>
      {items.map((item) => (
        <div key={item.label} className={styles.areaRow}>
          <div className={styles.areaMeta}>
            <span className={styles.areaName}>{item.label}</span>
            <span className={styles.areaPct}>{item.hint}</span>
          </div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ items }) {
  const total = items.reduce((sum, item) => sum + item.total, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={styles.donutWrap}>
      <svg className={styles.donutSvg} viewBox="0 0 140 140" aria-hidden="true">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="var(--line-soft)"
          strokeWidth="16"
        />
        {items.map((item) => {
          const portion = item.total / total;
          const length = portion * circumference;
          const dashOffset = -offset;
          offset += length;
          return (
            <circle
              key={item.status}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={STATUS_COLORS[item.status] || "#94a3b8"}
              strokeWidth="16"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 70 70)"
            />
          );
        })}
        <text className={styles.donutCenter} x="70" y="68">
          {Math.round(
            ((items.find((i) => i.status === "approved")?.total || 0) / total) *
              100,
          )}
          %
        </text>
        <text className={styles.donutCenterSub} x="70" y="84">
          Approved
        </text>
      </svg>
      <div className={styles.donutLegend}>
        {items.map((item) => (
          <div key={item.status} className={styles.donutLegendItem}>
            <span className={styles.donutLegendLeft}>
              <span
                className={styles.donutSwatch}
                style={{
                  background: STATUS_COLORS[item.status] || "#94a3b8",
                }}
              />
              {item.label}
            </span>
            <span className={styles.donutLegendValue}>
              {item.total} · {Math.round((item.total / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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
    statusBreakdown = [],
    approvalQueue = [],
    topAgents = [],
    areas = [],
    activity = [],
    recentPending = [],
    recentAgents = [],
  } = data;

  const attentionCount = approvalQueue.length + recentPending.length;

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

      <div className={styles.opsRow}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Platform Growth</h2>
            <span className={styles.listSecondary}>
              Running totals · last 6 months
            </span>
          </div>
          <div className={styles.chartBody}>
            <GrowthChart properties={propertyGrowth} agents={agentGrowth} />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Property Status Overview</h2>
          </div>
          <div className={styles.chartBody}>
            {statusBreakdown.length === 0 ? (
              <p className={styles.chartEmpty}>No properties yet.</p>
            ) : (
              <DonutChart items={statusBreakdown} />
            )}
          </div>
        </section>
      </div>

      <div className={styles.opsRow}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Listings by Agent</h2>
            <Link href="/admin/dashboard/agents" className={styles.panelLink}>
              Manage
            </Link>
          </div>
          {topAgents.length === 0 ? (
            <p className={styles.empty}>No agent listings yet.</p>
          ) : (
            <BarList
              items={topAgents.map((agent) => ({
                label: agent.full_name,
                value: agent.total_properties,
                hint: `${agent.approved_properties} live · ${agent.total_properties} total`,
              }))}
            />
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Popular Areas</h2>
            <span className={styles.listSecondary}>By listing location</span>
          </div>
          {areas.length === 0 ? (
            <p className={styles.empty}>No location data yet.</p>
          ) : (
            <BarList
              items={areas.map((area) => ({
                label: area.name,
                value: area.total,
                hint: `${area.total} · ${area.percent}%`,
              }))}
            />
          )}
        </section>
      </div>

      <div className={styles.opsRow}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Needs Attention</h2>
            <Link href="/admin/dashboard/approvals" className={styles.panelLink}>
              View all
            </Link>
          </div>
          {attentionCount === 0 ? (
            <div className={styles.allClear}>
              <span className={styles.allClearIcon} aria-hidden="true">
                ✓
              </span>
              <div>
                <p className={styles.listPrimary}>You are all caught up</p>
                <p className={styles.listSecondary}>
                  No listings or agent requests are waiting for review.
                </p>
              </div>
            </div>
          ) : (
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Agent</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {approvalQueue.map((item) => (
                  <tr key={`prop-${item.id}`}>
                    <td>
                      <p className={styles.listPrimary}>{item.title}</p>
                      <p className={styles.listSecondary}>
                        {item.location || "Property submission"}
                      </p>
                    </td>
                    <td>{item.agent_name}</td>
                    <td>
                      <Link
                        href={`/admin/dashboard/approvals/${item.id}`}
                        className={styles.panelLink}
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
                {recentPending.map((req) => (
                  <tr key={`req-${req.id}`}>
                    <td>
                      <p className={styles.listPrimary}>{req.full_name}</p>
                      <p className={styles.listSecondary}>
                        Agent access request · {req.estate_name}
                      </p>
                    </td>
                    <td>
                      <a href={`mailto:${req.email}`} className={styles.mailLink}>
                        {req.email}
                      </a>
                    </td>
                    <td>
                      <Link
                        href="/admin/dashboard/requests"
                        className={styles.panelLink}
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent Agents</h2>
            <Link href="/admin/dashboard/agents" className={styles.panelLink}>
              Manage
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
                      /re/{agent.estate_name} · joined{" "}
                      {formatDate(agent.created_at)}
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
          <h2 className={styles.panelTitle}>Recent Activity</h2>
        </div>
        {activity.length === 0 ? (
          <p className={styles.empty}>No recent platform activity.</p>
        ) : (
          <div className={styles.timeline}>
            {activity.map((item) => (
              <div key={item.id} className={styles.timelineItem}>
                <span className={styles.timelineDot} aria-hidden="true" />
                <div>
                  <p className={styles.timelineTitle}>{item.title}</p>
                  {item.detail ? (
                    <p className={styles.timelineDetail}>{item.detail}</p>
                  ) : null}
                  <p className={styles.timelineTime}>
                    {formatDateTime(item.at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
