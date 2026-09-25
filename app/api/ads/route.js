import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { BOT_PATTERN, getAd } from "@/lib/ads/serve";
import { placementSchema } from "@/lib/ads/validation";

// Public "Get Ad" endpoint for the customer site.
//   GET /api/ads?format=leaderboard_728x90&placement=home_top&exclude=4,9
//   → { ad: {...} }  paid/featured ad, else a free ad
//   → { ad: null }   nothing eligible — hide the slot
// See docs/ads-network.md for the full response shape.

export const dynamic = "force-dynamic";

const VIEWER_COOKIE = "ad_vid";

const paramsSchema = z.object({
  format: z.string().regex(/^[a-z0-9_]{2,50}$/, "format must be an ad format code"),
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
    return NextResponse.json({ ad: null }, { headers: { "Cache-Control": "no-store" } });
  }

  // Anonymous, random viewer id — only used for per-viewer frequency caps.
  let viewerId = req.cookies.get(VIEWER_COOKIE)?.value;
  const isNewViewer = !viewerId || viewerId.length > 64;
  if (isNewViewer) viewerId = nanoid(21);

  let ad = null;
  try {
    ad = await getAd({ ...parsed.data, viewerId });
  } catch (err) {
    console.error("Ad serving failed:", err);
    return NextResponse.json(
      { ad: null, error: "Ads are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const res = NextResponse.json({ ad }, { headers: { "Cache-Control": "no-store" } });
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
