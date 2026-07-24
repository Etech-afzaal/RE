import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rows = await query(
      `SELECT
         (SELECT COUNT(*) FROM signup_requests WHERE status = 'pending') AS pendingRequests,
         (SELECT COUNT(*) FROM signup_requests) AS totalRequests,
         (SELECT COUNT(*) FROM agents WHERE status = 'active') AS activeAgents,
         (SELECT COUNT(*) FROM agents WHERE status = 'disabled') AS disabledAgents,
         (SELECT COUNT(*) FROM agents) AS totalAgents,
         (SELECT COUNT(*) FROM properties WHERE status = 'active') AS activeProperties,
         (SELECT COUNT(*) FROM properties WHERE status = 'sold') AS soldProperties,
         (SELECT COUNT(*) FROM properties WHERE status = 'draft') AS draftProperties,
         (SELECT COUNT(*) FROM properties) AS totalProperties`,
    );

    const stats = rows[0] || {};

    const recentPending = await query(
      `SELECT id, full_name, email, estate_name, phone, created_at, status
       FROM signup_requests
       WHERE status = 'pending'
       ORDER BY created_at DESC
       LIMIT 5`,
    );

    const recentAgents = await query(
      `SELECT id, full_name, email, estate_name, status, created_at
       FROM agents
       ORDER BY created_at DESC
       LIMIT 5`,
    );

    return Response.json({
      stats: {
        pendingRequests: Number(stats.pendingRequests) || 0,
        totalRequests: Number(stats.totalRequests) || 0,
        activeAgents: Number(stats.activeAgents) || 0,
        disabledAgents: Number(stats.disabledAgents) || 0,
        totalAgents: Number(stats.totalAgents) || 0,
        activeProperties: Number(stats.activeProperties) || 0,
        soldProperties: Number(stats.soldProperties) || 0,
        draftProperties: Number(stats.draftProperties) || 0,
        totalProperties: Number(stats.totalProperties) || 0,
      },
      recentPending,
      recentAgents,
    });
  } catch (err) {
    console.error("Failed to fetch admin stats:", err);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
