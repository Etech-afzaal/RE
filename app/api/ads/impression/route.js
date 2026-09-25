import { NextResponse } from "next/server";
import { BOT_PATTERN, recordAdEvent } from "@/lib/ads/serve";

// Viewability beacon: the frontend calls this once the ad has been at least
// 50% on screen for 1 second (lib/ads/client.js does this for you).
// Body: { "token": "<ad.impressionToken>" }. Accepts sendBeacon payloads.

export async function POST(req) {
  if (BOT_PATTERN.test(req.headers.get("user-agent") || "")) {
    return new NextResponse(null, { status: 204 });
  }

  let token;
  try {
    token = JSON.parse(await req.text())?.token;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const { counted, adId } = await recordAdEvent(token, "impression");
  if (!adId) return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  return NextResponse.json({ counted });
}
