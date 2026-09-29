// Run with: npm run test:ads
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AD_LOCATIONS,
  LOCATION_KEYS,
  LOCATION_PAGES,
  formatCodesForLocations,
  getLocation,
  locationLabel,
} from "./locations.js";

test("the seven ad locations, grouped by page", () => {
  assert.deepEqual(LOCATION_KEYS, [
    "home_above_hero",
    "home_below_hero",
    "agent_site_below_hero",
    "agent_site_after_listings",
    "property_below_hero",
    "property_before_gallery",
    "agent_dashboard_top",
  ]);
  assert.deepEqual(
    LOCATION_PAGES.map((group) => [group.page, group.locations.length]),
    [
      ["Landing page", 2],
      ["Agent public site", 2],
      ["Property detail page", 2],
      ["Agent dashboard", 1],
    ],
  );
  assert.equal(new Set(LOCATION_KEYS).size, AD_LOCATIONS.length);
});

test("locations set the sizes: the Billboard set", () => {
  assert.deepEqual(formatCodesForLocations(["home_above_hero", "agent_dashboard_top"]), [
    "billboard_970x250",
    "leaderboard_728x90",
    "mobile_banner_320x100",
  ]);
  assert.deepEqual(formatCodesForLocations([]), []);
});

test("labels", () => {
  assert.equal(locationLabel("home_below_hero"), "Landing page · Below the hero");
  assert.equal(locationLabel("old_placement"), "old_placement");
  assert.equal(getLocation("nope"), null);
});
