import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { toActivityItem } from "@/lib/auditLogger";
import {
  AGENT_LIVE_STATUS,
  PROPERTY_PUBLIC_STATUS,
  PROPERTY_STATUS,
  toClientAgentStatus,
} from "@/lib/status";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Last N calendar months as { key: 'YYYY-MM', label: 'Jan' }. */
function lastNMonths(n = 6) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: MONTH_LABELS[d.getMonth()] });
  }
  return months;
}

/**
 * Fill missing months with zeros and add a running total.
 * The cumulative value keeps the growth line meaningful even when a young
 * platform only has activity in one or two months.
 */
function fillMonthlySeries(months, rows, startingTotal = 0) {
  const map = new Map(
    rows.map((row) => [String(row.month), Number(row.total) || 0]),
  );
  let running = Number(startingTotal) || 0;
  return months.map((m) => {
    const total = map.get(m.key) || 0;
    running += total;
    return { month: m.key, label: m.label, total, cumulative: running };
  });
}

function percentChange(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) {
    return cur > 0 ? 100 : 0;
  }
  return Math.round(((cur - prev) / prev) * 100);
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const months = lastNMonths(6);
    const rangeStart = `${months[0].key}-01`;

    const countRows = await query(
      `SELECT
         (SELECT COUNT(*) FROM signup_requests WHERE status = 'pending') AS pendingRequests,
         (SELECT COUNT(*) FROM signup_requests) AS totalRequests,
         (SELECT COUNT(*) FROM users WHERE status = ? AND user_type = 'agent') AS activeAgents,
         (SELECT COUNT(*) FROM users WHERE status = 'disabled' AND user_type = 'agent') AS disabledAgents,
         (SELECT COUNT(*) FROM users WHERE status = 'blocked' AND user_type = 'agent') AS blockedAgents,
         (SELECT COUNT(*) FROM users WHERE user_type = 'agent') AS totalAgents,
         (SELECT COUNT(*) FROM properties WHERE status = ?) AS activeProperties,
         (SELECT COUNT(*) FROM properties WHERE status = 'pending_approval') AS pendingProperties,
         (SELECT COUNT(*) FROM properties WHERE status = 'sold') AS soldProperties,
         (SELECT COUNT(*) FROM properties WHERE status = 'draft') AS draftProperties,
         (SELECT COUNT(*) FROM properties WHERE status = 'rejected') AS rejectedProperties,
         (SELECT COUNT(*) FROM properties WHERE status = 'hidden') AS hiddenProperties,
         (SELECT COUNT(*) FROM properties) AS totalProperties,
         (SELECT COUNT(*) FROM properties
           WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS propertiesThisMonth,
         (SELECT COUNT(*) FROM properties
           WHERE created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
             AND created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS propertiesLastMonth,
         (SELECT COUNT(*) FROM users
           WHERE user_type = 'agent' AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS agentsThisMonth,
         (SELECT COUNT(*) FROM users
           WHERE user_type = 'agent' AND created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
             AND created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS agentsLastMonth`,
      [AGENT_LIVE_STATUS, PROPERTY_PUBLIC_STATUS],
    );

    const stats = countRows[0] || {};

    const [
      propertyGrowthRows,
      agentGrowthRows,
      baselineRows,
      recentPending,
      recentAgents,
      approvalQueue,
      blockedAgents,
      recentAuditLogs,
    ] = await Promise.all([
      query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
         FROM properties
         WHERE created_at >= ?
         GROUP BY month
         ORDER BY month`,
        [rangeStart],
      ),
      query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
         FROM users
         WHERE user_type = 'agent' AND created_at >= ?
         GROUP BY month
         ORDER BY month`,
        [rangeStart],
      ),
      // Totals that already existed before the chart window, so the
      // cumulative line starts from the real platform size.
      query(
        `SELECT
           (SELECT COUNT(*) FROM properties WHERE created_at < ?) AS propertiesBefore,
           (SELECT COUNT(*) FROM users WHERE user_type = 'agent' AND created_at < ?) AS agentsBefore`,
        [rangeStart, rangeStart],
      ),
      query(
        `SELECT id, full_name, email, estate_name, phone, created_at, status
         FROM signup_requests
         WHERE status = 'pending'
         ORDER BY created_at DESC
         LIMIT 5`,
      ),
      query(
        `SELECT a.id, a.full_name, a.email, a.estate_name, a.status, a.created_at,
                COUNT(p.id) AS total_properties
         FROM users a
         LEFT JOIN properties p ON p.agent_id = a.id
         WHERE a.user_type = 'agent'
         GROUP BY a.id, a.full_name, a.email, a.estate_name, a.status, a.created_at
         ORDER BY a.created_at DESC
         LIMIT 5`,
      ),
      query(
        `SELECT p.id, p.title, p.location, p.submitted_at, p.created_at,
                a.full_name AS agent_name, a.estate_name
         FROM properties p
         JOIN users a ON a.id = p.agent_id
         WHERE p.status = ?
         ORDER BY COALESCE(p.submitted_at, p.created_at) DESC
         LIMIT 6`,
        [PROPERTY_STATUS.PENDING_APPROVAL],
      ),
      query(
        `SELECT id, full_name, estate_name, status, blocked_at, created_at
         FROM users
         WHERE user_type = 'agent' AND status = 'blocked'
         ORDER BY COALESCE(blocked_at, created_at) DESC
         LIMIT 5`,
      ),
      query(
        `SELECT al.id, al.user_id, al.action, al.entity_type, al.entity_id,
                al.description, al.metadata, al.created_at,
                u.full_name AS user_name, u.user_type, u.username, u.estate_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ORDER BY al.created_at DESC
         LIMIT 10`,
      ),
    ]);

    const activity = recentAuditLogs.map(toActivityItem);

    const baseline = baselineRows[0] || {};
    const propertiesThisMonth = Number(stats.propertiesThisMonth) || 0;
    const propertiesLastMonth = Number(stats.propertiesLastMonth) || 0;
    const agentsThisMonth = Number(stats.agentsThisMonth) || 0;
    const agentsLastMonth = Number(stats.agentsLastMonth) || 0;

    return Response.json({
      stats: {
        pendingRequests: Number(stats.pendingRequests) || 0,
        totalRequests: Number(stats.totalRequests) || 0,
        activeAgents: Number(stats.activeAgents) || 0,
        disabledAgents: Number(stats.disabledAgents) || 0,
        blockedAgents: Number(stats.blockedAgents) || 0,
        totalAgents: Number(stats.totalAgents) || 0,
        activeProperties: Number(stats.activeProperties) || 0,
        pendingProperties: Number(stats.pendingProperties) || 0,
        soldProperties: Number(stats.soldProperties) || 0,
        draftProperties: Number(stats.draftProperties) || 0,
        rejectedProperties: Number(stats.rejectedProperties) || 0,
        hiddenProperties: Number(stats.hiddenProperties) || 0,
        totalProperties: Number(stats.totalProperties) || 0,
        propertiesThisMonth,
        propertiesLastMonth,
        propertiesTrend: percentChange(propertiesThisMonth, propertiesLastMonth),
        agentsThisMonth,
        agentsLastMonth,
        agentsTrend: percentChange(agentsThisMonth, agentsLastMonth),
      },
      propertyGrowth: fillMonthlySeries(
        months,
        propertyGrowthRows,
        Number(baseline.propertiesBefore) || 0,
      ),
      agentGrowth: fillMonthlySeries(
        months,
        agentGrowthRows,
        Number(baseline.agentsBefore) || 0,
      ),
      approvalQueue: approvalQueue.map((row) => ({
        ...row,
        id: Number(row.id),
      })),
      blockedAgents: blockedAgents.map((agent) => ({
        ...agent,
        id: Number(agent.id),
        status: toClientAgentStatus(agent.status),
      })),
      activity,
      recentPending,
      recentAgents: recentAgents.map((agent) => ({
        ...agent,
        status: toClientAgentStatus(agent.status),
        total_properties: Number(agent.total_properties) || 0,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch admin stats:", err);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
