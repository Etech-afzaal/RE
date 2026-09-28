import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import {
  checkAdReferences,
  getActivationError,
  getAdById,
  getAdStats,
  setAdStatus,
  updateAd,
} from "@/lib/ads/queries";
import { generateSizes, removeCreativeFiles } from "@/lib/ads/images";
import { adInputSchema, fieldErrors, firstError } from "@/lib/ads/validation";

export async function GET(req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const ad = await getAdById(params.id);
  if (!ad) return NextResponse.json({ error: "Ad not found." }, { status: 404 });

  const days = req.nextUrl.searchParams.get("days") || 30;
  return NextResponse.json({ ad, stats: await getAdStats(ad.id, days) });
}

export async function PUT(req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const existing = await getAdById(params.id);
  if (!existing) return NextResponse.json({ error: "Ad not found." }, { status: 404 });
  if (existing.status === "archived") {
    return NextResponse.json(
      { error: "Archived ads are read-only. Restore the ad first." },
      { status: 409 },
    );
  }

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

  // Removed sizes lose their images; new sizes are made from the main image.
  const { added, removed } = await updateAd(existing.id, parsed.data);
  await removeCreativeFiles(removed);
  let ad = await getAdById(existing.id);
  const imageWarnings = [];
  if (added.length > 0 && ad.master_image_url) {
    imageWarnings.push(...(await generateSizes(ad, added)));
    ad = await getAdById(ad.id);
  }

  // A live ad must stay servable. If the edit broke that (e.g. linked a sold
  // property), keep the edit but switch the ad OFF and say why.
  let warning = null;
  if (ad.status === "active") {
    const activationError = getActivationError(ad);
    if (activationError) {
      await setAdStatus(ad.id, "paused");
      ad = await getAdById(ad.id);
      warning = `Saved, but the ad was turned OFF: ${activationError}`;
    }
  }

  return NextResponse.json({ success: true, ad, warning, imageWarnings });
}

// Ads are archived, not deleted, so their stats and payment notes are kept.
export async function DELETE(_req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const ad = await getAdById(params.id);
  if (!ad) return NextResponse.json({ error: "Ad not found." }, { status: 404 });

  await setAdStatus(ad.id, "archived");
  return NextResponse.json({ success: true, archived: true });
}
