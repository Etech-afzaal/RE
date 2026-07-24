import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const agents = await query(
      `SELECT
         a.id,
         a.full_name,
         a.email,
         a.phone,
         a.estate_name,
         a.status,
         a.must_reset_password,
         a.created_at,
         (
           SELECT COUNT(*) FROM properties p WHERE p.agent_id = a.id
         ) AS property_count,
         (
           SELECT COUNT(*) FROM properties p
           WHERE p.agent_id = a.id AND p.status = 'active'
         ) AS active_count,
         (
           SELECT sr.id FROM signup_requests sr
           WHERE sr.email = a.email
           ORDER BY sr.created_at DESC
           LIMIT 1
         ) AS request_id
       FROM agents a
       ORDER BY a.created_at DESC`,
    );

    return Response.json({
      agents: agents.map((a) => ({
        ...a,
        property_count: Number(a.property_count) || 0,
        active_count: Number(a.active_count) || 0,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    return Response.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
