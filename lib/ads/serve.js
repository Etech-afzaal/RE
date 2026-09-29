import { query } from "@/lib/db";
import {
  AD_SELECT,
  attachCreatives,
  getDestinationUrl,
  getFormatByCode,
  getPropertyAdUrl,
  normalizeAd,
} from "@/lib/ads/queries";
import { applyViewerCaps, getDisplayState, orderForCarousel, pickAd } from "@/lib/ads/pick";
import { MAX_SLIDES } from "@/lib/ads/locations";
import { createAdToken, hashViewerId, newTokenId, readAdToken } from "@/lib/ads/tokens";
import { statDate } from "@/lib/ads/time";

/**
 * Customer-side "Get Ad". Flow: Paid/Featured ad → Free ad fallback → no ad.
 *
 * Only ads that have the requested size compete, so a desktop-only ad never
 * shows on a phone. The winner's other sizes listed in `also` come back as
 * `variants`, so the slot can swap size on resize without a new request.
 *
 * @param {object}   opts
 * @param {string}   opts.format     ad_formats.code for the current screen, e.g. "leaderboard_728x90" (required)
 * @param {string[]} [opts.also]     other format codes this slot may switch to, e.g. ["mobile_banner_320x100"]
 * @param {string}   [opts.placement] where the slot lives, e.g. "home_top" (reporting only)
 * @param {number[]} [opts.exclude]   ad ids already shown on this page (no duplicates)
 * @param {string}   [opts.viewerId]  anonymous viewer id, enables per-viewer caps
 * @returns {Promise<object|null>} public ad payload, or null when nothing qualifies
 */
export async function getAd({ format, also = [], placement = "", exclude = [], viewerId = null }) {
  const adFormat = await getFormatByCode(format);
  if (!adFormat || !adFormat.is_active) return null;

  const viewerHash = hashViewerId(viewerId);
  const candidates = await loadCandidates(adFormat, { exclude, viewerHash });
  const ad = pickAd(candidates);
  await recordFill(adFormat.id, statDate(), ad?.tier ?? null);
  if (!ad) return null;

  return toPublicAd(ad, adFormat.code, also, { placement, viewerHash });
}

/**
 * The ads for one location's carousel (lib/ads/locations.js): every live ad
 * assigned to the location that has the requested size — paid first, then
 * free, highest priority first — up to MAX_SLIDES. Same options as getAd,
 * plus `location` (required); the location is also the stats placement.
 * @returns {Promise<object[]>} public ad payloads, [] when nothing qualifies
 */
export async function getAds({ location, format, also = [], exclude = [], viewerId = null }) {
  const adFormat = await getFormatByCode(format);
  if (!adFormat || !adFormat.is_active) return [];

  const viewerHash = hashViewerId(viewerId);
  const candidates = await loadCandidates(adFormat, { location, exclude, viewerHash });
  const ads = orderForCarousel(candidates, MAX_SLIDES);
  await recordFill(adFormat.id, statDate(), ads[0]?.tier ?? null);

  return ads.map((ad) =>
    toPublicAd(ad, adFormat.code, also, { placement: location, viewerHash }),
  );
}

// Live ads that have the given size (and location), minus excluded ones and
// ads this viewer has already seen enough today.
async function loadCandidates(adFormat, { location = null, exclude = [], viewerHash = null }) {
  // Coarse filter in SQL; getDisplayState() below applies the exact same
  // rules the admin list uses (property active, caps, every size has an image).
  const rows = await query(
    `${AD_SELECT}
     WHERE a.status = 'active'
       AND a.start_at <= UTC_TIMESTAMP()
       AND (a.end_at IS NULL OR a.end_at > UTC_TIMESTAMP())
       AND EXISTS (SELECT 1 FROM ad_creatives c WHERE c.ad_id = a.id AND c.format_id = ?)
       ${location ? "AND EXISTS (SELECT 1 FROM ad_locations l WHERE l.ad_id = a.id AND l.location = ?)" : ""}`,
    location ? [statDate(), adFormat.id, location] : [statDate(), adFormat.id],
  );

  const excluded = new Set(exclude.map(Number));
  let candidates = (await attachCreatives(rows.map(normalizeAd))).filter(
    (ad) => !excluded.has(ad.id) && getDisplayState(ad).state === "live",
  );

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
  return candidates;
}

function toPublicProperty(ad) {
  if (!ad.property_id) return null;
  return {
    id: ad.property_id,
    title: ad.property_title,
    price: ad.property_price,
    priceCurrency: ad.property_price_currency,
    location: ad.property_location,
    size:
      ad.property_size_value != null ? `${ad.property_size_value} ${ad.property_size_unit}` : null,
    estateName: ad.property_estate_name,
    agentName: ad.property_agent_name,
    url: getPropertyAdUrl(ad),
  };
}

// The parts of the payload that change with the size.
function toVariant(ad, creative, tokenOptions) {
  const token = createAdToken({ adId: ad.id, formatId: creative.format_id, ...tokenOptions });
  return {
    format: {
      code: creative.format_code,
      type: creative.format_type,
      width: creative.width,
      height: creative.height,
    },
    // "image": an uploaded banner made for this size — show it as-is.
    // "property": no banner, imageUrl is the property's photo — compose a card.
    creativeType: creative.image_url ? "image" : "property",
    imageUrl: creative.image_url || ad.property_image,
    // Always link through clickUrl so the click is counted; it redirects
    // to the real destination. null means the ad isn't clickable.
    clickUrl: ad.destination_url ? `/api/ads/click?t=${encodeURIComponent(token)}` : null,
    impressionToken: token,
  };
}

function toPublicAd(ad, formatCode, also, { placement, viewerHash }) {
  // One token id for all sizes: however often the slot swaps size, this
  // view counts as one impression (and one click at most).
  const tokenOptions = { placement, viewerHash, tokenId: newTokenId() };
  const wanted = new Set([formatCode, ...also]);
  const sizes = ad.creatives.filter(
    (creative) => wanted.has(creative.format_code) && creative.format_is_active,
  );
  const variants = sizes.map((creative) => toVariant(ad, creative, tokenOptions));
  const current = variants.find((variant) => variant.format.code === formatCode);

  return {
    id: ad.id,
    tier: ad.tier,
    isFeatured: ad.tier === "paid",
    label: ad.tier === "paid" ? "Featured" : null,
    ...current,
    headline: ad.headline || ad.property_title || null,
    altText: ad.alt_text || ad.headline || ad.property_title || "Advertisement",
    ctaText: ad.cta_text || (ad.property_id ? "View property" : null),
    property: toPublicProperty(ad),
    opensNewTab: Boolean(ad.destination_url && !ad.destination_url.startsWith("/")),
    // This ad's sizes for every requested format, including the current one.
    variants,
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
    `INSERT IGNORE INTO ad_events (ad_id, format_id, event_type, token_id, viewer_hash, placement, created_at)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [data.adId, data.formatId, eventType, data.tokenId, data.viewerHash, data.placement],
  );
  if (!inserted.affectedRows) return { counted: false, adId: data.adId };

  const column = eventType === "click" ? "clicks" : "impressions";
  await query(`UPDATE ads SET total_${column} = total_${column} + 1 WHERE id = ?`, [data.adId]);
  await query(
    `INSERT INTO ad_stats_daily (ad_id, stat_date, placement, format_id, ${column}) VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
    [data.adId, statDate(), data.placement, data.formatId ?? 0],
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
