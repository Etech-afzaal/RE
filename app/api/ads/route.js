import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { LOCATION_KEYS } from "@/lib/ads/locations";
import { BOT_PATTERN, getAd, getAds } from "@/lib/ads/serve";
import { placementSchema } from "@/lib/ads/validation";

// Public "Get Ad" endpoint for the customer site.
//   GET /api/ads?location=home_above_hero&format=billboard_970x250&also=…
//   → { ads: [...], ad: ads[0] }  the location's carousel (paid first, max 5)
//   GET /api/ads?format=leaderboard_728x90&also=mobile_banner_320x100&placement=home_top&exclude=4,9
//   format = the size for the current screen; also = other sizes the slot
//   may switch to (returned in ad.variants when the ad has them)
//   → { ad: {...} }  paid/featured ad, else a free ad
//   → { ad: null }   nothing eligible — hide the slot
// See docs/ads-network.md for the full response shape.

export const dynamic = "force-dynamic";

const VIEWER_COOKIE = "ad_vid";

const FORMAT_CODE = /^[a-z0-9_]{2,50}$/;

const paramsSchema = z.object({
  format: z.string().regex(FORMAT_CODE, "format must be an ad format code"),
  location: z
    .enum(LOCATION_KEYS, { errorMap: () => ({ message: "Unknown location." }) })
    .optional(),
  also: z
    .string()
    .optional()
    .transform((value) =>
      (value || "")
        .split(",")
        .filter((code) => FORMAT_CODE.test(code))
        .slice(0, 5),
    ),
  placement: placementSchema,
  exclude: z
    .string()
    .optional()
    .transform((value) =>
      (value || "")
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
        .slice(0, 50),
    ),
});

export async function GET(req) {
  const search = req.nextUrl.searchParams;
  const parsed = paramsSchema.safeParse({
    format: search.get("format") ?? "",
    also: search.get("also") ?? undefined,
    location: search.get("location") || undefined,
    placement: search.get("placement") ?? undefined,
    exclude: search.get("exclude") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ad: null, error: parsed.error.issues[0].message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Bots get nothing: they'd skew fill stats and never produce real views.
  if (BOT_PATTERN.test(req.headers.get("user-agent") || "")) {
    return NextResponse.json({ ad: null, ads: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  // Anonymous, random viewer id — only used for per-viewer frequency caps.
  let viewerId = req.cookies.get(VIEWER_COOKIE)?.value;
  const isNewViewer = !viewerId || viewerId.length > 64;
  if (isNewViewer) viewerId = nanoid(21);

  let body;
  try {
    const { location, ...options } = parsed.data;
    if (location) {
      const ads = await getAds({ ...options, location, viewerId });
      body = { ads, ad: ads[0] || null };
    } else {
      body = { ad: await getAd({ ...options, viewerId }) };
    }
  } catch (err) {
    console.error("Ad serving failed:", err);
    return NextResponse.json(
      { ad: null, ads: [], error: "Ads are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const res = NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  if (isNewViewer) {
    res.cookies.set(VIEWER_COOKIE, viewerId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
