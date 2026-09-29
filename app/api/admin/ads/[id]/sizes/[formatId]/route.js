import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdById } from "@/lib/ads/queries";
import {
  AdImageError,
  generateSizes,
  parseFit,
  readUpload,
  removeSizeImage,
  saveCustomSize,
} from "@/lib/ads/images";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";

// One size of an ad.
//   POST   multipart { image, fit } — a custom image for this size only
//   PATCH  { fit }                  — remake this size from the main image
//                                     (also replaces a custom upload)
//   DELETE                          — remove this size's image

async function loadSize(params) {
  const ad = await getAdById(params.id);
  if (!ad) throw new AdImageError("Ad not found.", 404);
  if (ad.status === "archived") throw new AdImageError("Archived ads are read-only.", 409);
  const creative = ad.creatives.find((item) => item.format_id === Number(params.formatId));
  if (!creative) throw new AdImageError("This ad doesn't have that size.", 404);
  return { ad, creative };
}

async function handle(run) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;
  try {
    return await run();
  } catch (err) {
    if (err instanceof AdImageError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export function POST(req, { params }) {
  return handle(async () => {
    const { ad, creative } = await loadSize(params);
    const formData = await req.formData();
    const upload = await readUpload(formData.get("image"));
    const warning = await saveCustomSize(ad, creative, upload, parseFit(formData.get("fit")));
    return NextResponse.json({ success: true, ad: await getAdById(ad.id), warning });
  });
}

export function PATCH(req, { params }) {
  return handle(async () => {
    const { ad, creative } = await loadSize(params);
    const { fit } = await req.json().catch(() => ({}));
    const warnings = await generateSizes(ad, [creative.format_id], {
      [creative.format_id]: parseFit(fit),
    });
    return NextResponse.json({ success: true, ad: await getAdById(ad.id), warning: warnings[0] || null });
  });
}

export function DELETE(_req, { params }) {
  return handle(async () => {
    const { ad, creative } = await loadSize(params);
    if (ad.status === "active" && creative.format_is_active && !ad.property_image) {
      return NextResponse.json(
        { error: "This ad is ON and this size has no property photo to fall back to. Turn it OFF first." },
        { status: 409 },
      );
    }
    await removeSizeImage(ad, creative);
    return NextResponse.json({ success: true, ad: await getAdById(ad.id) });
  });
}
