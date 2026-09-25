import { query } from "@/lib/db";
import {
  AD_SELECT,
  getDestinationUrl,
  getFormatByCode,
  getPropertyAdUrl,
  normalizeAd,
} from "@/lib/ads/queries";
import { applyViewerCaps, getDisplayState, pickAd } from "@/lib/ads/pick";
import { createAdToken, hashViewerId, readAdToken } from "@/lib/ads/tokens";
import { statDate } from "@/lib/ads/time";

/**
 * Customer-side "Get Ad". Flow: Paid/Featured ad → Free ad fallback → no ad.
 *
 * @param {object}   opts
 * @param {string}   opts.format     ad_formats.code, e.g. "leaderboard_728x90" (required)
 * @param {string}   [opts.placement] where the slot lives, e.g. "home_top" (reporting only)
 * @param {number[]} [opts.exclude]   ad ids already shown on this page (no duplicates)
 * @param {string}   [opts.viewerId]  anonymous viewer id, enables per-viewer caps
 * @returns {Promise<object|null>} public ad payload, or null when nothing qualifies
 */
export async function getAd({ format, placement = "", exclude = [], viewerId = null }) {
  const adFormat = await getFormatByCode(format);
  if (!adFormat || !adFormat.is_active) return null;

  const today = statDate();
  // Coarse filter in SQL; getDisplayState() below applies the exact same
  // rules the admin list uses (property active, caps, creative present).
  const rows = await query(
    `${AD_SELECT}
     WHERE a.format_id = ? AND a.status = 'active'
       AND a.start_at <= UTC_TIMESTAMP()
       AND (a.end_at IS NULL OR a.end_at > UTC_TIMESTAMP())`,
    [today, adFormat.id],
  );

  const excluded = new Set(exclude.map(Number));
  let candidates = rows
    .map(normalizeAd)
    .filter((ad) => !excluded.has(ad.id) && getDisplayState(ad).state === "live");

  const viewerHash = hashViewerId(viewerId);
  const capped = candidates.filter((ad) => ad.viewer_cap_24h);
  if (viewerHash && capped.length > 0) {
    const ids = capped.map((ad) => ad.id);
    const seen = await query(
      `SELECT ad_id, COUNT(*) AS n FROM ad_events
       WHERE viewer_hash = ? AND event_type = 'impression'
         AND created_at > UTC_TIMESTAMP() - INTERVAL 1 DAY
         AND ad_id IN (${ids.map(() => "?").join(",")})
       GROUP BY ad_id`,
      [viewerHash, ...ids],
    );
    candidates = applyViewerCaps(
      candidates,
      Object.fromEntries(seen.map((row) => [row.ad_id, Number(row.n)])),
    );
  }

  const ad = pickAd(candidates);
  await recordFill(adFormat.id, today, ad?.tier ?? null);
  if (!ad) return null;

  return toPublicAd(ad, adFormat, createAdToken({ adId: ad.id, placement, viewerHash }));
}

function toPublicAd(ad, adFormat, token) {
  const property = ad.property_id
    ? {
        id: ad.property_id,
        title: ad.property_title,
        price: ad.property_price,
        priceCurrency: ad.property_price_currency,
        location: ad.property_location,
        size:
          ad.property_size_value != null
            ? `${ad.property_size_value} ${ad.property_size_unit}`
            : null,
        estateName: ad.property_estate_name,
        agentName: ad.property_agent_name,
        url: getPropertyAdUrl(ad),
      }
    : null;

  return {
    id: ad.id,
    tier: ad.tier,
    isFeatured: ad.tier === "paid",
    label: ad.tier === "paid" ? "Featured" : null,
    format: {
      code: adFormat.code,
      type: adFormat.format_type,
      width: adFormat.width,
      height: adFormat.height,
    },
    // "image": an uploaded banner made for this size — show it as-is.
    // "property": no banner, imageUrl is the property's photo — compose a card.
    creativeType: ad.image_url ? "image" : "property",
    imageUrl: ad.image_url || ad.property_image,
    headline: ad.headline || ad.property_title || null,
    altText: ad.alt_text || ad.headline || ad.property_title || "Advertisement",
    ctaText: ad.cta_text || (property ? "View property" : null),
    property,
    // Always link through clickUrl so the click is counted; it redirects
    // to the real destination. null means the ad isn't clickable.
    clickUrl: ad.destination_url ? `/api/ads/click?t=${encodeURIComponent(token)}` : null,
    opensNewTab: Boolean(ad.destination_url && !ad.destination_url.startsWith("/")),
    impressionToken: token,
  };
}

async function recordFill(formatId, day, tier) {
  const column = tier === "paid" ? "paid_fills" : tier === "free" ? "free_fills" : "no_fills";
  try {
    await query(
      `INSERT INTO ad_fill_daily (format_id, stat_date, ${column}) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
      [formatId, day],
    );
  } catch (err) {
    // Stats must never stop an ad from being served.
    console.error("ad fill stat failed:", err);
  }
}

/**
 * Records an impression or click for a served token. Each token counts at
 * most once per event type. Returns { counted, adId }.
 */
export async function recordAdEvent(token, eventType) {
  const data = readAdToken(token, eventType);
  if (!data) return { counted: false, adId: null };
  if (data.expired) return { counted: false, adId: data.adId };

  const inserted = await query(
    `INSERT IGNORE INTO ad_events (ad_id, event_type, token_id, viewer_hash, placement, created_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [data.adId, eventType, data.tokenId, data.viewerHash, data.placement],
  );
  if (!inserted.affectedRows) return { counted: false, adId: data.adId };

  const column = eventType === "click" ? "clicks" : "impressions";
  await query(`UPDATE ads SET total_${column} = total_${column} + 1 WHERE id = ?`, [data.adId]);
  await query(
    `INSERT INTO ad_stats_daily (ad_id, stat_date, placement, ${column}) VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
    [data.adId, statDate(), data.placement],
  );
  return { counted: true, adId: data.adId };
}

export async function getAdDestination(adId) {
  const rows = await query(
    `SELECT a.click_url, a.property_id, p.title AS property_title,
       ag.estate_name AS property_estate_name, ag.username AS property_username
     FROM ads a
     LEFT JOIN properties p ON p.id = a.property_id
     LEFT JOIN users ag ON ag.id = p.agent_id AND ag.user_type = 'agent'
     WHERE a.id = ?`,
    [Number(adId)],
  );
  return rows[0] ? getDestinationUrl(rows[0]) : null;
}

export const BOT_PATTERN = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit/i;
