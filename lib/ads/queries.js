import { query } from "@/lib/db";
import { getDisplayState } from "@/lib/ads/pick";
import { fromMysqlUtc, statDate, toMysqlUtc } from "@/lib/ads/time";
import { getPropertyUrl } from "@/lib/propertySlug";
import { isAgentLive, isPropertyPublic } from "@/lib/status";

// Shared by the admin screens and the serving path so "Live" in the admin
// list means exactly "can be served right now". First param: today's stat date.
export const AD_SELECT = `
  SELECT a.*,
    f.code AS format_code, f.name AS format_name, f.format_type,
    f.width AS format_width, f.height AS format_height, f.is_active AS format_is_active,
    p.title AS property_title, p.status AS property_status, p.is_hidden AS property_is_hidden,
    p.price AS property_price, p.price_currency AS property_price_currency,
    p.location AS property_location, p.size_value AS property_size_value,
    p.size_unit AS property_size_unit,
    ag.status AS agent_status, ag.estate_name AS property_estate_name,
    ag.username AS property_username, ag.full_name AS property_agent_name,
    (SELECT pi.image_url FROM property_images pi WHERE pi.property_id = p.id
      ORDER BY pi.is_featured DESC, pi.sort_order ASC, pi.id ASC LIMIT 1) AS property_image,
    COALESCE(td.impressions, 0) AS today_impressions
  FROM ads a
  JOIN ad_formats f ON f.id = a.format_id
  LEFT JOIN properties p ON p.id = a.property_id
  LEFT JOIN users ag ON ag.id = p.agent_id AND ag.user_type = 'agent'
  LEFT JOIN (
    SELECT ad_id, SUM(impressions) AS impressions
    FROM ad_stats_daily WHERE stat_date = ? GROUP BY ad_id
  ) td ON td.ad_id = a.id`;

const AD_COLUMNS = [
  "title",
  "tier",
  "format_id",
  "property_id",
  "headline",
  "alt_text",
  "cta_text",
  "click_url",
  "priority",
  "weight",
  "start_at",
  "end_at",
  "max_impressions",
  "max_clicks",
  "daily_impression_cap",
  "viewer_cap_24h",
  "advertiser_name",
  "advertiser_contact",
  "amount_paid",
  "payment_ref",
  "notes",
];

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

export function normalizeAd(row) {
  const ad = {
    ...row,
    start_at: fromMysqlUtc(row.start_at),
    end_at: fromMysqlUtc(row.end_at),
    format_is_active: Boolean(row.format_is_active),
    amount_paid: toNumber(row.amount_paid),
    property_price: toNumber(row.property_price),
    property_size_value: toNumber(row.property_size_value),
    total_impressions: Number(row.total_impressions),
    total_clicks: Number(row.total_clicks),
    today_impressions: Number(row.today_impressions),
    // Same public-visibility rules as the rest of the site (lib/status.js).
    property_is_public: isPropertyPublic(row.property_status) && !row.property_is_hidden,
    agent_is_live: isAgentLive(row.agent_status),
  };
  ad.destination_url = getDestinationUrl(ad);
  return ad;
}

// Canonical public URL of the linked property, or null.
export function getPropertyAdUrl(ad) {
  if (!ad.property_id) return null;
  const url = getPropertyUrl({
    id: ad.property_id,
    title: ad.property_title,
    username: ad.property_username,
    estate_name: ad.property_estate_name,
  });
  return url === "#" ? null : url;
}

export function getDestinationUrl(ad) {
  return ad.click_url || getPropertyAdUrl(ad);
}

function withDisplayState(ad) {
  const { state, reason = null } = getDisplayState(ad);
  return { ...ad, display_state: state, display_reason: reason };
}

// ---------------------------------------------------------------- ads

export async function listAds({ includeArchived = false } = {}) {
  const rows = await query(
    `${AD_SELECT}
     ${includeArchived ? "" : "WHERE a.status != 'archived'"}
     ORDER BY a.status = 'active' DESC, a.tier = 'paid' DESC, a.priority DESC, a.id DESC`,
    [statDate()],
  );
  return rows.map((row) => withDisplayState(normalizeAd(row)));
}

export async function getAdById(id) {
  const rows = await query(`${AD_SELECT} WHERE a.id = ?`, [statDate(), Number(id)]);
  return rows[0] ? withDisplayState(normalizeAd(rows[0])) : null;
}

function adValues(input) {
  return AD_COLUMNS.map((column) => {
    if (column === "start_at" || column === "end_at") return toMysqlUtc(input[column]);
    return input[column] ?? null;
  });
}

export async function createAd(input) {
  const result = await query(
    `INSERT INTO ads (${AD_COLUMNS.join(", ")}, status)
     VALUES (${AD_COLUMNS.map(() => "?").join(", ")}, 'draft')`,
    adValues(input),
  );
  return result.insertId;
}

export async function updateAd(id, input) {
  await query(
    `UPDATE ads SET ${AD_COLUMNS.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
    [...adValues(input), Number(id)],
  );
}

export async function setAdStatus(id, status) {
  await query("UPDATE ads SET status = ? WHERE id = ?", [status, Number(id)]);
}

export async function setAdImage(id, imageUrl) {
  await query("UPDATE ads SET image_url = ? WHERE id = ?", [imageUrl, Number(id)]);
}

// Returns an error message if the format/property the ad points at is missing.
export async function checkAdReferences(input) {
  const format = await getFormatById(input.format_id);
  if (!format) return "Selected ad format does not exist.";

  if (input.property_id) {
    const rows = await query("SELECT id FROM properties WHERE id = ?", [input.property_id]);
    if (rows.length === 0) return "Selected property does not exist.";
  }
  return null;
}

// Returns a human-readable reason the ad can't be switched ON, or null.
export function getActivationError(ad) {
  if (!ad.format_is_active) return "This ad format is turned off. Turn the format on first.";
  if (ad.tier === "paid" && !ad.end_at) return "Paid ads need an end date.";
  if (ad.end_at && new Date(ad.end_at) <= new Date()) {
    return "The end date has already passed. Extend the schedule first.";
  }
  if (ad.property_id && !ad.property_is_public) {
    return "The linked property is not published or is hidden.";
  }
  if (ad.property_id && !ad.agent_is_live) {
    return "The linked property's agent account is not approved.";
  }
  if (!ad.image_url && !ad.property_image) {
    return "Upload an image, or link a property that has photos, before turning the ad on.";
  }
  return null;
}

export async function getAdStats(id, days = 30) {
  const safeDays = Math.max(1, Math.min(365, Number(days) || 30));
  const since = statDate(new Date(Date.now() - (safeDays - 1) * 86_400_000));

  const daily = await query(
    `SELECT stat_date, SUM(impressions) AS impressions, SUM(clicks) AS clicks
     FROM ad_stats_daily WHERE ad_id = ? AND stat_date >= ?
     GROUP BY stat_date ORDER BY stat_date DESC`,
    [Number(id), since],
  );
  const placements = await query(
    `SELECT placement, SUM(impressions) AS impressions, SUM(clicks) AS clicks
     FROM ad_stats_daily WHERE ad_id = ?
     GROUP BY placement ORDER BY impressions DESC`,
    [Number(id)],
  );

  const toStat = (row) => ({
    ...row,
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
  });
  return { days: safeDays, daily: daily.map(toStat), placements: placements.map(toStat) };
}

// ---------------------------------------------------------------- formats

export async function listFormats() {
  const since = statDate(new Date(Date.now() - 6 * 86_400_000));
  const rows = await query(
    `SELECT f.*,
       (SELECT COUNT(*) FROM ads a WHERE a.format_id = f.id AND a.status != 'archived') AS ad_count,
       (SELECT COUNT(*) FROM ads a WHERE a.format_id = f.id) AS total_ad_count,
       (SELECT COUNT(*) FROM ads a WHERE a.format_id = f.id AND a.status = 'active') AS active_count,
       COALESCE(fd.paid_fills, 0) AS paid_fills_7d,
       COALESCE(fd.free_fills, 0) AS free_fills_7d,
       COALESCE(fd.no_fills, 0) AS no_fills_7d
     FROM ad_formats f
     LEFT JOIN (
       SELECT format_id, SUM(paid_fills) AS paid_fills, SUM(free_fills) AS free_fills,
              SUM(no_fills) AS no_fills
       FROM ad_fill_daily WHERE stat_date >= ? GROUP BY format_id
     ) fd ON fd.format_id = f.id
     ORDER BY f.is_active DESC, f.format_type, f.width DESC`,
    [since],
  );
  return rows.map((row) => ({
    ...row,
    is_active: Boolean(row.is_active),
    ad_count: Number(row.ad_count),
    total_ad_count: Number(row.total_ad_count),
    active_count: Number(row.active_count),
    paid_fills_7d: Number(row.paid_fills_7d),
    free_fills_7d: Number(row.free_fills_7d),
    no_fills_7d: Number(row.no_fills_7d),
  }));
}

export async function getFormatById(id) {
  const rows = await query("SELECT * FROM ad_formats WHERE id = ?", [Number(id)]);
  return rows[0] ? { ...rows[0], is_active: Boolean(rows[0].is_active) } : null;
}

export async function getFormatByCode(code) {
  const rows = await query("SELECT * FROM ad_formats WHERE code = ?", [code]);
  return rows[0] || null;
}

export async function createFormat(input) {
  const result = await query(
    "INSERT INTO ad_formats (code, name, format_type, width, height, is_active) VALUES (?, ?, ?, ?, ?, ?)",
    [input.code, input.name, input.format_type, input.width, input.height, input.is_active],
  );
  return result.insertId;
}

export async function updateFormat(id, input) {
  await query(
    "UPDATE ad_formats SET code = ?, name = ?, format_type = ?, width = ?, height = ?, is_active = ? WHERE id = ?",
    [input.code, input.name, input.format_type, input.width, input.height, input.is_active, Number(id)],
  );
}

// Every ad pointing at the format, archived ones included.
export async function countAllAdsForFormat(formatId) {
  const rows = await query("SELECT COUNT(*) AS n FROM ads WHERE format_id = ?", [Number(formatId)]);
  return Number(rows[0]?.n || 0);
}

// Only for unused formats (callers check countAllAdsForFormat first). Its
// fill stats go with it (ad_fill_daily cascades).
export async function deleteFormat(formatId) {
  await query("DELETE FROM ad_formats WHERE id = ?", [Number(formatId)]);
}

export async function countAdsWithImages(formatId) {
  const rows = await query(
    "SELECT COUNT(*) AS n FROM ads WHERE format_id = ? AND image_url IS NOT NULL AND status != 'archived'",
    [Number(formatId)],
  );
  return Number(rows[0]?.n || 0);
}

// ---------------------------------------------------------------- properties

// Admin property picker: searches every agent's listings.
export async function searchProperties(term) {
  const q = String(term || "").trim().slice(0, 100);
  const like = `%${q}%`;
  const rows = await query(
    `SELECT p.id, p.title, p.location, p.price, p.price_currency, p.size_value, p.size_unit,
       p.status, p.is_hidden,
       a.estate_name, a.username, a.full_name AS agent_name, a.status AS agent_status,
       (SELECT pi.image_url FROM property_images pi WHERE pi.property_id = p.id
         ORDER BY pi.is_featured DESC, pi.sort_order ASC, pi.id ASC LIMIT 1) AS image_url
     FROM properties p
     JOIN users a ON a.id = p.agent_id AND a.user_type = 'agent'
     ${q ? "WHERE p.title LIKE ? OR p.location LIKE ? OR a.estate_name LIKE ? OR a.full_name LIKE ? OR p.id = ?" : ""}
     ORDER BY p.status = 'approved' AND p.is_hidden = FALSE DESC, p.created_at DESC
     LIMIT 20`,
    q ? [like, like, like, like, Number(q) || 0] : [],
  );
  return rows.map((row) => {
    const isPublic = isPropertyPublic(row.status) && !row.is_hidden;
    const agentLive = isAgentLive(row.agent_status);
    return {
      ...row,
      price: toNumber(row.price),
      is_hidden: Boolean(row.is_hidden),
      is_public: isPublic,
      agent_is_live: agentLive,
      // Why the picker disables it; null when the property can be advertised.
      unavailable_reason: !agentLive
        ? "agent not approved"
        : row.is_hidden
          ? "hidden"
          : isPublic
            ? null
            : String(row.status).replace(/_/g, " "),
      url: getPropertyUrl(row),
    };
  });
}
