import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import {
  countAdsWithImages,
  countAllAdsForFormat,
  deleteFormat,
  getFormatByCode,
  getFormatById,
  updateFormat,
} from "@/lib/ads/queries";
import { fieldErrors, firstError, formatInputSchema } from "@/lib/ads/validation";

// Inactive formats (is_active=false) stop serving immediately.
export async function PUT(req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const existing = await getFormatById(params.id);
  if (!existing) return NextResponse.json({ error: "Format not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = formatInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstError(parsed), fields: fieldErrors(parsed) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.code !== existing.code) {
    const clash = await getFormatByCode(input.code);
    if (clash) {
      return NextResponse.json(
        { error: "A format with this code already exists.", fields: { code: "Already in use." } },
        { status: 409 },
      );
    }
  }

  const sizeChanged = input.width !== existing.width || input.height !== existing.height;
  if (sizeChanged && (await countAdsWithImages(existing.id)) > 0) {
    return NextResponse.json(
      {
        error: "Ads with uploaded images use this size. Create a new format instead of resizing this one.",
      },
      { status: 409 },
    );
  }

  await updateFormat(existing.id, input);
  return NextResponse.json({ success: true, format: await getFormatById(existing.id) });
}

// A format can only be deleted while no ad uses it — archived ads included,
// since they keep their stats and can be restored. Otherwise turn it off.
export async function DELETE(_req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const format = await getFormatById(params.id);
  if (!format) return NextResponse.json({ error: "Format not found." }, { status: 404 });

  const adCount = await countAllAdsForFormat(format.id);
  if (adCount > 0) {
    return NextResponse.json(
      {
        error: `${adCount} ad${adCount === 1 ? " uses" : "s use"} this format (archived ads included), so it can't be deleted. Turn it off instead to stop it serving.`,
        adCount,
      },
      { status: 409 },
    );
  }

  await deleteFormat(format.id);
  return NextResponse.json({ success: true, deleted: true });
}
