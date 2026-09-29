import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdById } from "@/lib/ads/queries";
import { sizesMissingImage, sizeLabel } from "@/lib/ads/pick";
import { AdImageError, readUpload, removeMasterImage, saveMasterImage } from "@/lib/ads/images";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";

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
  const { session, error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const ad = await loadEditableAd(params.id);
    const formData = await req.formData();
    const upload = await readUpload(formData.get("image"));
    const warnings = await saveMasterImage(ad, upload, {
      fits: parseJson(formData.get("fits"), {}),
      replace: parseJson(formData.get("replace"), []),
    });

    const actorName = session.user.name || "Superadmin";
    await createAuditLog({
      userId: Number(session.user.id),
      action: AUDIT_ACTIONS.AD_IMAGE_UPLOADED,
      entityType: AUDIT_ENTITY_TYPES.AD,
      entityId: ad.id,
      description: `${actorName} uploaded image for ad "${ad.title || `Ad #${ad.id}`}"`,
      metadata: {
        ad_id: ad.id,
        ad_title: ad.title || null,
        actor_name: actorName,
      },
      ipAddress: getRequestIp(req),
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

export async function DELETE(req, { params }) {
  const { session, error: authError } = await requireAdmin();
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

    const actorName = session.user.name || "Superadmin";
    await createAuditLog({
      userId: Number(session.user.id),
      action: AUDIT_ACTIONS.AD_IMAGE_REMOVED,
      entityType: AUDIT_ENTITY_TYPES.AD,
      entityId: ad.id,
      description: `${actorName} removed image from ad "${ad.title || `Ad #${ad.id}`}"`,
      metadata: {
        ad_id: ad.id,
        ad_title: ad.title || null,
        actor_name: actorName,
      },
      ipAddress: getRequestIp(req),
    });

    return NextResponse.json({ success: true, ad: await getAdById(ad.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
