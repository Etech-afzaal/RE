// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ADS_SECRET = "test-secret";
const { createAdToken, readAdToken, hashViewerId } = await import("./tokens.js");

test("token round-trips ad id, placement and viewer", () => {
  const token = createAdToken({ adId: 42, placement: "home_top", viewerHash: "abc" });
  const data = readAdToken(token, "impression");
  assert.equal(data.adId, 42);
  assert.equal(data.placement, "home_top");
  assert.equal(data.viewerHash, "abc");
  assert.equal(data.tokenId.length, 16);
  assert.equal(data.expired, false);
});

test("every token gets a fresh id (each serve counts once)", () => {
  const a = readAdToken(createAdToken({ adId: 1 }), "impression");
  const b = readAdToken(createAdToken({ adId: 1 }), "impression");
  assert.notEqual(a.tokenId, b.tokenId);
});

test("tampered tokens are rejected", () => {
  const token = createAdToken({ adId: 1 });
  const [payload, signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url")), a: 999 }),
  ).toString("base64url");

  assert.equal(readAdToken(`${forged}.${signature}`, "impression"), null);
  assert.equal(readAdToken("garbage", "impression"), null);
  assert.equal(readAdToken(undefined, "click"), null);
});

test("impression tokens expire before click tokens", () => {
  const realNow = Date.now;
  const token = createAdToken({ adId: 1 });
  try {
    Date.now = () => realNow() + 2 * 60 * 60 * 1000; // +2h
    assert.equal(readAdToken(token, "impression").expired, true);
    assert.equal(readAdToken(token, "click").expired, false);
  } finally {
    Date.now = realNow;
  }
});

test("viewer ids are hashed, never stored raw", () => {
  const hash = hashViewerId("viewer-123");
  assert.equal(hash.length, 32);
  assert.notEqual(hash, "viewer-123");
  assert.equal(hashViewerId(null), null);
});
