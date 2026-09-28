import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdById } from "@/lib/ads/queries";
import { sizesMissingImage, sizeLabel } from "@/lib/ads/pick";
import { AdImageError, readUpload, removeMasterImage, saveMasterImage } from "@/lib/ads/images";

// The ad's main image. Every size is made from it automatically (see
// lib/ads/images.js); sizes with a custom upload keep theirs.
//
// POST multipart: image, fits (JSON { formatId: "cover"|"contain" }),
//                 replace (JSON [formatId] — custom uploads to replace too)
// DELETE: removes the main image and the sizes made from it.

function parseJson(value, fallback) {
  try {
    return typeof value === "string" && value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function loadEditableAd(id) {
  const ad = await getAdById(id);
  if (!ad) throw new AdImageError("Ad not found.", 404);
  if (ad.status === "archived") throw new AdImageError("Archived ads are read-only.", 409);
  return ad;
}

const errorResponse = (err) => {
  if (err instanceof AdImageError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
};

export async function POST(req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const ad = await loadEditableAd(params.id);
    const formData = await req.formData();
    const upload = await readUpload(formData.get("image"));
    const warnings = await saveMasterImage(ad, upload, {
      fits: parseJson(formData.get("fits"), {}),
      replace: parseJson(formData.get("replace"), []),
    });
    return NextResponse.json({
      success: true,
      ad: await getAdById(ad.id),
      source: { width: upload.metadata.width, height: upload.metadata.height },
      warnings,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const ad = await loadEditableAd(params.id);
    if (ad.status === "active") {
      // Sizes left with no image once the generated ones are gone.
      const after = {
        ...ad,
        creatives: ad.creatives.map((creative) =>
          creative.source === "generated" ? { ...creative, image_url: null } : creative,
        ),
      };
      const missing = sizesMissingImage(after);
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: `This ad is ON and ${missing.map(sizeLabel).join(", ")} would have no image. Turn it OFF first.`,
          },
          { status: 409 },
        );
      }
    }
    await removeMasterImage(ad);
    return NextResponse.json({ success: true, ad: await getAdById(ad.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
