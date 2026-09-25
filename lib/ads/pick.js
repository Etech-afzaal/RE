// Pure ad-selection rules — no DB access, so they can be unit tested.
//
// Given ads that already passed the eligibility checks (status, dates,
// format, caps, property still active):
//   1. Paid ads always win over free ads (free is only a fallback).
//   2. Inside the winning tier, only the highest `priority` competes.
//   3. Inside that priority band, ads rotate by `weight`
//      (weights 200 and 100 → roughly 67% / 33% of requests).
// Returns null when there is nothing to show.

export function pickAd(candidates, random = Math.random) {
  if (!candidates || candidates.length === 0) return null;

  const paid = candidates.filter((ad) => ad.tier === "paid");
  const pool = paid.length > 0 ? paid : candidates.filter((ad) => ad.tier === "free");
  if (pool.length === 0) return null;

  const topPriority = Math.max(...pool.map((ad) => Number(ad.priority) || 0));
  const band = pool.filter((ad) => (Number(ad.priority) || 0) === topPriority);

  return weightedChoice(band, random);
}

export function weightedChoice(items, random = Math.random) {
  const weights = items.map((item) => Math.max(1, Number(item.weight) || 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * total;

  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}

// Drops ads the viewer has already seen too often in the last 24h.
// `seenCounts` maps adId → impressions by this viewer in that window.
export function applyViewerCaps(candidates, seenCounts = {}) {
  return candidates.filter((ad) => {
    if (!ad.viewer_cap_24h) return true;
    return (seenCounts[ad.id] || 0) < Number(ad.viewer_cap_24h);
  });
}

// What the admin sees in the list. Only `status` is stored; everything
// else is derived from dates, caps and the linked property, so no cron job
// is needed to flip ads to "expired".
export const DISPLAY_STATES = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  paused: "Paused",
  expired: "Expired",
  completed: "Cap reached",
  capped_today: "Daily cap reached",
  blocked: "Blocked",
  archived: "Archived",
};

export function getDisplayState(ad, now = new Date()) {
  if (ad.status === "archived") return { state: "archived" };
  if (ad.status === "draft") return { state: "draft" };
  if (ad.status === "paused") return { state: "paused" };

  const nowMs = now.getTime();
  if (ad.end_at && new Date(ad.end_at).getTime() <= nowMs) {
    return { state: "expired" };
  }
  if (new Date(ad.start_at).getTime() > nowMs) return { state: "scheduled" };

  if (ad.format_is_active === false || ad.format_is_active === 0) {
    return { state: "blocked", reason: "Ad format is turned off." };
  }
  if (ad.property_id) {
    if (!ad.property_is_public) {
      return { state: "blocked", reason: "Linked property is not published (or is hidden)." };
    }
    if (!ad.agent_is_live) {
      return { state: "blocked", reason: "Property's agent account is not approved." };
    }
  }
  if (!ad.image_url && !ad.property_image) {
    return { state: "blocked", reason: "No image uploaded and no property image." };
  }

  if (ad.max_impressions && ad.total_impressions >= ad.max_impressions) {
    return { state: "completed" };
  }
  if (ad.max_clicks && ad.total_clicks >= ad.max_clicks) {
    return { state: "completed" };
  }
  if (ad.daily_impression_cap && (ad.today_impressions || 0) >= ad.daily_impression_cap) {
    return { state: "capped_today" };
  }
  return { state: "live" };
}
