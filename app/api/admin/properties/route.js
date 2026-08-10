import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import {
  PROPERTY_STATUS_INPUTS,
  toClientAgentStatus,
  toClientPropertyStatus,
  toDbPropertyStatus,
} from "@/lib/status";

export async function GET(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const requestedStatus = new URL(req.url).searchParams.get("status");
  if (requestedStatus && !PROPERTY_STATUS_INPUTS.has(requestedStatus)) {
    return Response.json({ error: "Unknown status filter." }, { status: 400 });
  }

  const filters = [];
  const params = [];
  if (requestedStatus) {
    filters.push("p.status = ?");
    params.push(toDbPropertyStatus(requestedStatus));
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const properties = await query(
      `SELECT
         p.id,
         p.title,
         p.price,
         p.price_currency,
         p.location,
         p.size_value,
         p.size_unit,
         p.status,
         p.submitted_at,
         p.approved_by,
         p.approved_at,
         p.rejected_reason,
         p.rejected_at,
         p.rejected_by,
         p.created_at,
         p.updated_at,
         a.id AS agent_id,
         a.full_name AS agent_name,
         a.estate_name,
         a.status AS agent_status,
         (
           SELECT pi.image_url
           FROM property_images pi
           WHERE pi.property_id = p.id
           ORDER BY pi.is_featured DESC, pi.sort_order ASC, pi.id ASC
           LIMIT 1
         ) AS image_url
       FROM properties p
       JOIN users a ON a.id = p.agent_id
       ${where}
       ORDER BY p.updated_at DESC, p.id DESC`,
      params,
    );

    return Response.json({
      properties: properties.map((p) => ({
        ...p,
        status: toClientPropertyStatus(p.status),
        agent_status: toClientAgentStatus(p.agent_status),
      })),
    });
  } catch (err) {
    console.error("Failed to fetch admin properties:", err);
    return Response.json(
      { error: "Failed to fetch properties" },
      { status: 500 },
    );
  }
}
