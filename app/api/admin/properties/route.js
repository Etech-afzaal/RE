import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const properties = await query(
      `SELECT
         p.id,
         p.title,
         p.price,
         p.location,
         p.size_value,
         p.size_unit,
         p.status,
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
       JOIN agents a ON a.id = p.agent_id
       ORDER BY p.updated_at DESC, p.id DESC`,
    );

    return Response.json({ properties });
  } catch (err) {
    console.error("Failed to fetch admin properties:", err);
    return Response.json(
      { error: "Failed to fetch properties" },
      { status: 500 },
    );
  }
}
