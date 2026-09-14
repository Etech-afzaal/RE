const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mappings, migrateRow, report } = require("./migrate-property-json.cjs");
const row = values => ({ id: 1, ...Object.fromEntries(Object.keys(mappings).map(key => [key, null])), property_data: null, ...values });

test("migration preserves exact nulls, whitespace, empty strings and nested JSON arrays", () => {
  const before = row({ property_type: "plot", property_subtype: "commercial_plot", city: " Lahore ", address: "", property_highlights: [{ title: " Test ", icon: "home", description: "" }], why_this_home: [] });
  const { next, conflicts } = migrateRow(before);
  assert.deepEqual(conflicts, []);
  assert.equal(next.listing_type, "plot");
  assert.equal(next.property_type, "commercial_plot");
  assert.equal(next.location.city, " Lahore ");
  assert.equal(next.location.address, "");
  assert.equal(next.location.phase, null);
  assert.deepEqual(next.insights.property_highlights, before.property_highlights);
  assert.deepEqual(next.insights.why_this_home, []);
  assert.equal(report([{ ...before, property_data: next }]).mismatchingRows, 0);
});

test("migration preserves unrelated JSON and accepts equal values regardless of object key order", () => {
  const before = row({ property_highlights: [{ title: "Home", icon: "home" }], property_data: { landInfo: { front: 30 }, custom: { reference: "keep" }, insights: { property_highlights: [{ icon: "home", title: "Home" }] } } });
  const { next, conflicts } = migrateRow(before);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(next.landInfo, before.property_data.landInfo);
  assert.deepEqual(next.custom, before.property_data.custom);
});

test("conflicts stop migration, including populated JSON paired with a NULL column", () => {
  const before = row({ property_data: { location: { city: "Keep me" } } });
  const { next, conflicts } = migrateRow(before);
  assert.equal(next.location.city, "Keep me");
  assert.equal(conflicts.length, 1);
  assert.equal(report([before]).conflictRows, 1);
});

test("invalid JSON sections fail without mutating the source", () => {
  for (const value of [[], "invalid", { location: [] }, { insights: "bad" }]) {
    const before = row({ property_data: value });
    assert.throws(() => migrateRow(before));
    assert.deepEqual(before.property_data, value);
  }
});
