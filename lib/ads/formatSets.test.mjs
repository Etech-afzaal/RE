// Run with: npm run test:ads
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORMAT_SETS,
  formatCodes,
  formatForScreen,
  getFormatSet,
  screenForWidth,
  screensForFormat,
} from "./formatSets.js";
import { adForFormat } from "./client.js";

test("screen widths map to desktop / tablet / mobile", () => {
  assert.equal(screenForWidth(375), "mobile");
  assert.equal(screenForWidth(767), "mobile");
  assert.equal(screenForWidth(768), "tablet");
  assert.equal(screenForWidth(1023), "tablet");
  assert.equal(screenForWidth(1024), "desktop");
  assert.equal(screenForWidth(1920), "desktop");
});

test("billboard slots use 728×90 on tablets", () => {
  const billboard = getFormatSet("billboard").screens;
  assert.equal(formatForScreen(billboard, "desktop"), "billboard_970x250");
  assert.equal(formatForScreen(billboard, "tablet"), "leaderboard_728x90");
  assert.equal(formatForScreen(billboard, "mobile"), "mobile_banner_320x100");
});

test("missing screens fall back to the next larger size", () => {
  const pair = { desktop: "leaderboard_728x90", mobile: "mobile_banner_320x100" };
  assert.equal(formatForScreen(pair, "tablet"), "leaderboard_728x90");
  assert.equal(formatForScreen({ desktop: "a_1x1" }, "mobile"), "a_1x1");
  assert.equal(formatForScreen("native_card_400x300", "mobile"), "native_card_400x300");
});

test("format codes are listed once per set", () => {
  assert.deepEqual(formatCodes(getFormatSet("billboard")), [
    "billboard_970x250",
    "leaderboard_728x90",
    "mobile_banner_320x100",
  ]);
  assert.deepEqual(formatCodes({ desktop: "a_1x1", tablet: "a_1x1" }), ["a_1x1"]);
  assert.deepEqual(formatCodes("native_card_400x300"), ["native_card_400x300"]);
  for (const set of FORMAT_SETS) assert.ok(formatCodes(set).length > 0, set.key);
});

test("screensForFormat names where a size shows", () => {
  assert.deepEqual(screensForFormat("billboard_970x250"), ["desktop"]);
  assert.deepEqual(screensForFormat("leaderboard_728x90"), ["tablet"]);
  assert.deepEqual(screensForFormat("mobile_banner_320x100"), ["mobile"]);
  assert.deepEqual(screensForFormat("unknown_1x1"), []);
});

test("a served ad swaps to its other size without a new request", () => {
  const ad = {
    id: 7,
    headline: "Launch",
    format: { code: "leaderboard_728x90", width: 728, height: 90 },
    imageUrl: "/desktop.jpg",
    impressionToken: "t-desktop",
    variants: [
      { format: { code: "leaderboard_728x90", width: 728, height: 90 }, imageUrl: "/desktop.jpg", impressionToken: "t-desktop" },
      { format: { code: "mobile_banner_320x100", width: 320, height: 100 }, imageUrl: "/mobile.jpg", impressionToken: "t-mobile" },
    ],
  };
  assert.equal(adForFormat(ad, "leaderboard_728x90"), ad);
  const mobile = adForFormat(ad, "mobile_banner_320x100");
  assert.equal(mobile.id, 7);
  assert.equal(mobile.headline, "Launch");
  assert.equal(mobile.imageUrl, "/mobile.jpg");
  assert.equal(mobile.format.width, 320);
  assert.equal(adForFormat(ad, "billboard_970x250"), null);
  assert.equal(adForFormat(null, "leaderboard_728x90"), null);
});
