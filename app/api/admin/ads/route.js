import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { checkAdReferences, createAd, getAdById, listAds } from "@/lib/ads/queries";
import { adInputSchema, fieldErrors, firstError } from "@/lib/ads/validation";

export async function GET(req) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
  const ads = await listAds({ includeArchived });
  return NextResponse.json({ ads });
}

// Ads are always created as drafts. The admin UI uploads the image next and
// then switches the ad ON through PATCH /api/admin/ads/[id]/status.
export async function POST(req) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const parsed = adInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstError(parsed), fields: fieldErrors(parsed) },
      { status: 400 },
    );
  }

  const referenceError = await checkAdReferences(parsed.data);
  if (referenceError) {
    return NextResponse.json({ error: referenceError }, { status: 400 });
  }

  const id = await createAd(parsed.data);
  return NextResponse.json({ success: true, ad: await getAdById(id) }, { status: 201 });
}
