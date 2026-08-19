import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchDatabaseLocation } from "./locationMatching.js";

describe("matchDatabaseLocation", () => {
  it("returns the exact database label for a reverse-geocoded address", () => {
    assert.equal(matchDatabaseLocation(["North District", "Central District"], { address: { neighbourhood: "North District", city: "Example City" } }), "North District");
  });
  it("handles component ordering and phase number variations", () => {
    assert.equal(matchDatabaseLocation(["Harbor Phase 5", "Harbor"], { address: { neighbourhood: "Phase V Harbor", city: "Example City" } }), "Harbor Phase 5");
  });
  it("accepts a confident spelling variation", () => {
    assert.equal(matchDatabaseLocation(["Harbor Quarter"], { address: { suburb: "Harbour Quarter" } }), "Harbor Quarter");
  });
  it("does not select an unrelated database location", () => {
    assert.equal(matchDatabaseLocation(["North District", "Harbor Phase 5"], { address: { city: "New Example City", suburb: "Unknown Quarter" } }), null);
  });
});
