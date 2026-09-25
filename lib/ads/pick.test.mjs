// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyViewerCaps, getDisplayState, pickAd, weightedChoice } from "./pick.js";

const ad = (id, tier, priority = 5, weight = 100, extra = {}) => ({
  id,
  tier,
  priority,
  weight,
  ...extra,
});

test("no candidates → no ad", () => {
  assert.equal(pickAd([]), null);
  assert.equal(pickAd(null), null);
});

test("paid always beats free, even with lower priority", () => {
  const picked = pickAd([ad(1, "free", 10, 1000), ad(2, "paid", 1, 1)]);
  assert.equal(picked.id, 2);
});

test("falls back to free when no paid ad is eligible", () => {
  assert.equal(pickAd([ad(1, "free")]).id, 1);
});

test("only the highest priority band competes within a tier", () => {
  for (let i = 0; i < 50; i++) {
    const picked = pickAd([ad(1, "paid", 5, 1000), ad(2, "paid", 9, 1), ad(3, "free", 10)]);
    assert.equal(picked.id, 2);
  }
});

test("weighted rotation splits traffic by weight", () => {
  const items = [ad(1, "paid", 5, 300), ad(2, "paid", 5, 100)];
  assert.equal(weightedChoice(items, () => 0).id, 1);
  assert.equal(weightedChoice(items, () => 0.74).id, 1);
  assert.equal(weightedChoice(items, () => 0.76).id, 2);
  assert.equal(weightedChoice(items, () => 0.9999).id, 2);

  let first = 0;
  for (let i = 0; i < 20000; i++) if (pickAd(items).id === 1) first++;
  assert.ok(Math.abs(first / 20000 - 0.75) < 0.02, `expected ~75%, got ${first / 200}%`);
});

test("viewer caps drop ads already seen enough", () => {
  const items = [ad(1, "paid", 5, 100, { viewer_cap_24h: 3 }), ad(2, "free")];
  assert.deepEqual(
    applyViewerCaps(items, { 1: 3 }).map((item) => item.id),
    [2],
  );
  assert.deepEqual(
    applyViewerCaps(items, { 1: 2 }).map((item) => item.id),
    [1, 2],
  );
});

test("display state follows dates, property and caps", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  const base = {
    status: "active",
    start_at: "2026-09-01T00:00:00Z",
    end_at: "2026-10-01T00:00:00Z",
    format_is_active: true,
    image_url: "/uploads/ads/1/x.jpg",
    total_impressions: 0,
    total_clicks: 0,
    today_impressions: 0,
  };
  const state = (extra) => getDisplayState({ ...base, ...extra }, now).state;

  assert.equal(state({}), "live");
  assert.equal(state({ status: "paused" }), "paused");
  assert.equal(state({ status: "draft" }), "draft");
  assert.equal(state({ start_at: "2026-09-24T00:00:00Z" }), "scheduled");
  assert.equal(state({ end_at: "2026-09-23T11:59:59Z" }), "expired");
  assert.equal(state({ end_at: null }), "live");
  assert.equal(state({ format_is_active: false }), "blocked");
  assert.equal(state({ property_id: 4, property_is_public: false, agent_is_live: true }), "blocked");
  assert.equal(state({ property_id: 4, property_is_public: true, agent_is_live: false }), "blocked");
  assert.equal(state({ image_url: null }), "blocked");
  assert.equal(
    state({ image_url: null, property_id: 4, property_is_public: true, agent_is_live: true, property_image: "/a.jpg" }),
    "live",
  );
  assert.equal(state({ max_impressions: 100, total_impressions: 100 }), "completed");
  assert.equal(state({ max_clicks: 5, total_clicks: 5 }), "completed");
  assert.equal(state({ daily_impression_cap: 50, today_impressions: 50 }), "capped_today");
});
