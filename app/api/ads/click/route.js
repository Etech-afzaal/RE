import { NextResponse } from "next/server";
import { BOT_PATTERN, getAdDestination, recordAdEvent } from "@/lib/ads/serve";
import { readAdToken } from "@/lib/ads/tokens";

// Click-through: counts the click, then redirects to the destination stored
// in the database. The target is never taken from the query string, so this
// can't be abused as an open redirect.
//   <a href={ad.clickUrl}>…</a>

export const dynamic = "force-dynamic";

export async function GET(req) {
  const token = req.nextUrl.searchParams.get("t");
  const data = readAdToken(token, "click");
  const home = new URL("/", req.url);
  if (!data) return NextResponse.redirect(home);

  if (!BOT_PATTERN.test(req.headers.get("user-agent") || "")) {
    try {
      await recordAdEvent(token, "click");
    } catch (err) {
      // Never block the visitor on a stats failure.
      console.error("Ad click tracking failed:", err);
    }
  }

  const destination = await getAdDestination(data.adId);
  return NextResponse.redirect(destination ? new URL(destination, req.url) : home);
}
