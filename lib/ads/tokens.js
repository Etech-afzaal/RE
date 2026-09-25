import crypto from "crypto";

// Every served ad carries a signed token. Impression and click beacons must
// send it back, which stops anyone from counting events for arbitrary ads.

const IMPRESSION_TTL_MS = 60 * 60 * 1000; // beacon must arrive within 1h
const CLICK_TTL_MS = 24 * 60 * 60 * 1000; // tabs left open still count clicks

function secret() {
  const value = process.env.ADS_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("ADS_SECRET (or NEXTAUTH_SECRET) must be set.");
  return value;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createAdToken({ adId, placement, viewerHash }) {
  const payload = Buffer.from(
    JSON.stringify({
      a: adId,
      t: crypto.randomBytes(8).toString("hex"), // 16 chars → ad_events.token_id
      p: placement || "",
      v: viewerHash || null,
      i: Date.now(),
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// Returns { adId, tokenId, placement, viewerHash, expired } or null if the
// token is malformed or the signature doesn't match.
export function readAdToken(token, eventType) {
  if (typeof token !== "string" || token.length > 1000) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!Number.isInteger(data.a) || typeof data.t !== "string") return null;

  const ttl = eventType === "click" ? CLICK_TTL_MS : IMPRESSION_TTL_MS;
  return {
    adId: data.a,
    tokenId: data.t,
    placement: data.p || "",
    viewerHash: data.v || null,
    expired: Date.now() - Number(data.i) > ttl,
  };
}

export function hashViewerId(viewerId) {
  if (!viewerId) return null;
  return crypto.createHash("sha256").update(String(viewerId)).digest("hex").slice(0, 32);
}
