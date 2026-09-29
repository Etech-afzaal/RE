import { query } from "@/lib/db";
import { getDisplayState, servableSizes, sizeLabel, sizesMissingImage } from "@/lib/ads/pick";
import { LOCATION_KEYS, formatCodesForLocations } from "@/lib/ads/locations";
import { fromMysqlUtc, statDate, toMysqlUtc } from "@/lib/ads/time";
import { getPropertyUrl } from "@/lib/propertySlug";
import { isAgentLive, isPropertyPublic } from "@/lib/status";

// Shared by the admin screens and the serving path so "Live" in the admin
// list means exactly "can be served right now". First param: today's stat date.
// An ad's sizes (ad_creatives) are loaded separately by attachCreatives().
export const AD_SELECT = `
  SELECT a.*,
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
  LEFT JOIN properties p ON p.id = a.property_id
  LEFT JOIN users ag ON ag.id = p.agent_id AND ag.user_type = 'agent'
  LEFT JOIN (
    SELECT ad_id, SUM(impressions) AS impressions
    FROM ad_stats_daily WHERE stat_date = ? GROUP BY ad_id
  ) td ON td.ad_id = a.id`;

const AD_COLUMNS = [
  "title",
  "tier",
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

// ---------------------------------------------------------------- sizes

const CREATIVE_SELECT = `
  SELECT c.id, c.ad_id, c.format_id, c.image_url, c.fit, c.source,
    f.code AS format_code, f.name AS format_name, f.format_type,
    f.width, f.height, f.is_active AS format_is_active
  FROM ad_creatives c
  JOIN ad_formats f ON f.id = c.format_id`;

function normalizeCreative(row) {
  return {
    ...row,
    width: Number(row.width),
    height: Number(row.height),
    format_is_active: Boolean(row.format_is_active),
  };
}

// Largest size first, so desktop sizes lead and mobile sizes follow.
const bySize = (a, b) => b.width * b.height - a.width * a.height || a.format_id - b.format_id;

// Adds `creatives` (the ad's sizes) to each ad.
export async function attachCreatives(ads) {
  if (ads.length === 0) return ads;
  const ids = ads.map((ad) => ad.id);
  const rows = await query(
    `${CREATIVE_SELECT} WHERE c.ad_id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  const byAd = new Map(ids.map((id) => [id, []]));
  for (const row of rows) byAd.get(row.ad_id)?.push(normalizeCreative(row));
  for (const ad of ads) ad.creatives = (byAd.get(ad.id) || []).sort(bySize);
  return ads;
}

// Makes the ad's sizes exactly `formatIds`. Returns the added format ids and
// the removed creatives (the caller deletes their image files).
export async function setAdSizes(adId, formatIds) {
  const wanted = [...new Set(formatIds.map(Number))];
  const current = await query(`${CREATIVE_SELECT} WHERE c.ad_id = ?`, [Number(adId)]);
  const currentIds = new Set(current.map((row) => row.format_id));

  const added = wanted.filter((id) => !currentIds.has(id));
  const removed = current.filter((row) => !wanted.includes(row.format_id)).map(normalizeCreative);

  if (removed.length > 0) {
    await query(
      `DELETE FROM ad_creatives WHERE ad_id = ? AND id IN (${removed.map(() => "?").join(",")})`,
      [Number(adId), ...removed.map((row) => row.id)],
    );
  }
  for (const formatId of added) {
    await query("INSERT IGNORE INTO ad_creatives (ad_id, format_id) VALUES (?, ?)", [
      Number(adId),
      formatId,
    ]);
  }
  return { added, removed };
}

// imageUrl null clears the size's image (it then uses the property photo).
export async function setCreativeImage(adId, formatId, { imageUrl, source, fit }) {
  await query(
    `UPDATE ad_creatives SET image_url = ?, source = ?, fit = COALESCE(?, fit)
     WHERE ad_id = ? AND format_id = ?`,
    [imageUrl, imageUrl ? source : null, fit ?? null, Number(adId), Number(formatId)],
  );
}

// ---------------------------------------------------------------- locations

// Adds `locations` (location keys, in AD_LOCATIONS order) to each ad.
export async function attachLocations(ads) {
  if (ads.length === 0) return ads;
  const ids = ads.map((ad) => ad.id);
  const rows = await query(
    `SELECT ad_id, location FROM ad_locations WHERE ad_id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  for (const ad of ads) {
    const keys = new Set(rows.filter((row) => row.ad_id === ad.id).map((row) => row.location));
    ad.locations = LOCATION_KEYS.filter((key) => keys.has(key));
  }
  return ads;
}

export async function setAdLocations(adId, keys) {
  await query("DELETE FROM ad_locations WHERE ad_id = ?", [Number(adId)]);
  if (keys.length > 0) {
    await query(
      `INSERT INTO ad_locations (ad_id, location) VALUES ${keys.map(() => "(?, ?)").join(", ")}`,
      keys.flatMap((key) => [Number(adId), key]),
    );
  }
}

// The ad_formats ids an ad needs for its locations, or { error } when one of
// those formats has been deleted or renamed.
export async function resolveLocationSizes(keys) {
  const codes = formatCodesForLocations(keys);
  if (codes.length === 0) return { formatIds: [] };
  const rows = await query(
    `SELECT id, code FROM ad_formats WHERE code IN (${codes.map(() => "?").join(",")})`,
    codes,
  );
  const missing = codes.filter((code) => !rows.some((row) => row.code === code));
  if (missing.length > 0) {
    return {
      error: `Ad format ${missing.join(", ")} is missing. Recreate it on the Ad Formats page — ad locations need it.`,
    };
  }
  return { formatIds: rows.map((row) => row.id) };
}

export async function setMasterImage(adId, imageUrl) {
  await query("UPDATE ads SET master_image_url = ? WHERE id = ?", [imageUrl, Number(adId)]);
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
  const ads = await attachCreatives(rows.map(normalizeAd));
  await attachLocations(ads);
  return ads.map(withDisplayState);
}

export async function getAdById(id) {
  const rows = await query(`${AD_SELECT} WHERE a.id = ?`, [statDate(), Number(id)]);
  if (!rows[0]) return null;
  const [ad] = await attachCreatives([normalizeAd(rows[0])]);
  await attachLocations([ad]);
  return withDisplayState(ad);
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
  await setAdSizes(result.insertId, input.format_ids);
  await setAdLocations(result.insertId, input.locations);
  return result.insertId;
}

// Returns what setAdSizes() changed, so the caller can tidy up images.
export async function updateAd(id, input) {
  await query(
    `UPDATE ads SET ${AD_COLUMNS.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
    [...adValues(input), Number(id)],
  );
  await setAdLocations(id, input.locations);
  return setAdSizes(id, input.format_ids);
}

export async function setAdStatus(id, status) {
  await query("UPDATE ads SET status = ? WHERE id = ?", [status, Number(id)]);
}

// Returns an error message if a format/property the ad points at is missing.
export async function checkAdReferences(input) {
  const ids = [...new Set(input.format_ids.map(Number))];
  const found = await query(
    `SELECT id FROM ad_formats WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  if (found.length !== ids.length) return "One of the selected sizes no longer exists.";

  if (input.property_id) {
    const rows = await query("SELECT id FROM properties WHERE id = ?", [input.property_id]);
    if (rows.length === 0) return "Selected property does not exist.";
  }
  return null;
}

// Returns a human-readable reason the ad can't be switched ON, or null.
export function getActivationError(ad) {
  if (!ad.locations || ad.locations.length === 0) return "Choose at least one location.";
  if (!ad.creatives || ad.creatives.length === 0) return "This ad has no sizes. Save it again to add them.";
  if (servableSizes(ad).length === 0) {
    return "All of this ad's sizes are turned off. Turn a format on (Ad Formats page) first.";
  }
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
  const missing = sizesMissingImage(ad);
  if (missing.length > 0) {
    return `Add an image for ${missing.map(sizeLabel).join(", ")}, or link a property that has photos, before turning the ad on.`;
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

  const sizes = await query(
    `SELECT s.format_id, f.name AS format_name, f.code AS format_code, f.width, f.height,
       SUM(s.impressions) AS impressions, SUM(s.clicks) AS clicks
     FROM ad_stats_daily s
     LEFT JOIN ad_formats f ON f.id = s.format_id
     WHERE s.ad_id = ?
     GROUP BY s.format_id, f.name, f.code, f.width, f.height
     ORDER BY impressions DESC`,
    [Number(id)],
  );

  const toStat = (row) => ({
    ...row,
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
  });
  return {
    days: safeDays,
    daily: daily.map(toStat),
    placements: placements.map(toStat),
    sizes: sizes.map(toStat),
  };
}

// ---------------------------------------------------------------- formats

export async function listFormats() {
  const since = statDate(new Date(Date.now() - 6 * 86_400_000));
  const rows = await query(
    `SELECT f.*,
       (SELECT COUNT(*) FROM ad_creatives c JOIN ads a ON a.id = c.ad_id
         WHERE c.format_id = f.id AND a.status != 'archived') AS ad_count,
       (SELECT COUNT(*) FROM ad_creatives c WHERE c.format_id = f.id) AS total_ad_count,
       (SELECT COUNT(*) FROM ad_creatives c JOIN ads a ON a.id = c.ad_id
         WHERE c.format_id = f.id AND a.status = 'active') AS active_count,
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

// Every ad using the format as one of its sizes, archived ones included.
export async function countAllAdsForFormat(formatId) {
  const rows = await query("SELECT COUNT(*) AS n FROM ad_creatives WHERE format_id = ?", [
    Number(formatId),
  ]);
  return Number(rows[0]?.n || 0);
}

// Only for unused formats (callers check countAllAdsForFormat first). Its
// fill stats go with it (ad_fill_daily cascades).
export async function deleteFormat(formatId) {
  await query("DELETE FROM ad_formats WHERE id = ?", [Number(formatId)]);
}

export async function countAdsWithImages(formatId) {
  const rows = await query(
    `SELECT COUNT(*) AS n FROM ad_creatives c JOIN ads a ON a.id = c.ad_id
     WHERE c.format_id = ? AND c.image_url IS NOT NULL AND a.status != 'archived'`,
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
