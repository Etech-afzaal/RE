import { query } from "@/lib/db";
import { INSIGHT_EVENT_TYPES } from "@/lib/marketingLinks";

export async function recordLinkInsight(marketingLinkId, eventType, metadata = null) {
  if (!INSIGHT_EVENT_TYPES.includes(eventType)) {
    return { ok: false, error: "Invalid event type." };
  }

  const linkId = Number(marketingLinkId);
  if (!Number.isInteger(linkId) || linkId <= 0) {
    return { ok: false, error: "Invalid marketing link." };
  }

  const metaJson =
    metadata && typeof metadata === "object" ? JSON.stringify(metadata) : null;

  await query(
    `INSERT INTO property_link_insights (marketing_link_id, event_type, metadata)
     VALUES (?, ?, ?)`,
    [linkId, eventType, metaJson],
  );

  return { ok: true };
}

export async function getLinkInsightCounts(marketingLinkId) {
  const rows = await query(
    `SELECT event_type, COUNT(*) AS count
     FROM property_link_insights
     WHERE marketing_link_id = ?
     GROUP BY event_type`,
    [marketingLinkId],
  );

  const counts = {
    page_view: 0,
    phone_click: 0,
    whatsapp_click: 0,
    email_sent: 0,
  };

  for (const row of rows) {
    if (row.event_type in counts) {
      counts[row.event_type] = Number(row.count) || 0;
    }
  }

  return counts;
}
