import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import {
  AUDIT_ACTIVITY_CATEGORIES,
  toLogListItem,
} from "@/lib/auditLogger";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

function dateRangeClause(range) {
  switch (String(range || "").toLowerCase()) {
    case "today":
      return "al.created_at >= CURDATE()";
    case "7d":
    case "last_7_days":
      return "al.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    case "30d":
    case "last_30_days":
      return "al.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    default:
      return null;
  }
}

export async function GET(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = String(searchParams.get("search") || "").trim();
  const type = String(searchParams.get("type") || "all").toLowerCase();
  const range = String(searchParams.get("range") || "all").toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number(searchParams.get("pageSize")) || PAGE_SIZE_DEFAULT),
  );

  try {
    const where = [];
    const params = [];

    const categoryTypes = AUDIT_ACTIVITY_CATEGORIES[type];
    if (categoryTypes?.length) {
      where.push(
        `al.entity_type IN (${categoryTypes.map(() => "?").join(", ")})`,
      );
      params.push(...categoryTypes);
    }

    const dateClause = dateRangeClause(range);
    if (dateClause) where.push(dateClause);

    if (search) {
      const like = `%${search}%`;
      where.push(
        `(u.full_name LIKE ?
          OR al.description LIKE ?
          OR al.action LIKE ?
          OR al.entity_type LIKE ?
          OR CAST(al.entity_id AS CHAR) LIKE ?
          OR CAST(al.metadata AS CHAR) LIKE ?)`,
      );
      params.push(like, like, like, like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const safePageSize = Math.max(1, Math.min(PAGE_SIZE_MAX, pageSize));
    const safeOffset = Math.max(0, (page - 1) * safePageSize);

    const [countRows, rows] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ${whereSql}`,
        params,
      ),
      query(
        `SELECT al.id, al.user_id, al.action, al.entity_type, al.entity_id,
                al.description, al.metadata, al.ip_address, al.created_at,
                u.full_name AS user_name, u.user_type, u.username, u.estate_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ${whereSql}
         ORDER BY al.created_at DESC, al.id DESC
         LIMIT ${safePageSize} OFFSET ${safeOffset}`,
        params,
      ),
    ]);

    const total = Number(countRows[0]?.total) || 0;

    return Response.json({
      logs: rows.map(toLogListItem),
      pagination: {
        page,
        pageSize: safePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePageSize)),
      },
    });
  } catch (err) {
    console.error("Failed to fetch audit logs:", err);
    return Response.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
