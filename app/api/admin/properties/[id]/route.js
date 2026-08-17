import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import {
  imageCategoryLabel,
  normalizeImageCategory,
} from "@/lib/imageCategories";
import {
  PROPERTY_STATUS,
  PROPERTY_STATUS_INPUTS,
  toClientPropertyStatus,
  toDbPropertyStatus,
} from "@/lib/status";
import { validateRejectionReason } from "@/lib/validators/userValidator";

/** Short label stored in approved_by / rejected_by (the env admin has no row). */
function adminIdentity(session) {
  return String(session?.user?.email || session?.user?.id || "admin").slice(0, 100);
}

/**
 * Full listing detail for the admin review screen.
 * Unlike the list endpoint this returns the raw database status — there is no
 * legacy consumer to keep on the old "active" wording.
 */
export async function GET(_req, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const propertyId = Number(params.id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  try {
    const rows = await query(
      `SELECT
         p.*,
         a.id AS agent_id,
         a.full_name AS agent_name,
         a.estate_name,
         a.username AS agent_username,
         a.email AS agent_email,
         a.phone AS agent_phone,
         a.company_name AS agent_company,
         a.status AS agent_status
       FROM properties p
       JOIN users a ON a.id = p.agent_id
       WHERE p.id = ?
       LIMIT 1`,
      [propertyId],
    );
    const property = rows[0];
    if (!property) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    const imageRows = await query(
      `SELECT id, image_url, image_title, category, is_featured, sort_order
       FROM property_images
       WHERE property_id = ?
       ORDER BY is_featured DESC, sort_order ASC, id ASC`,
      [propertyId],
    );
    const images = imageRows.map((image) => {
      const category = normalizeImageCategory(image.category);
      return { ...image, category, category_label: imageCategoryLabel(category) };
    });

    let videos = [];
    try {
      let videoRows;
      try {
        videoRows = await query(
          `SELECT id, video_url, thumbnail_url, category, is_featured, display_order, created_at
           FROM property_videos
           WHERE property_id = ?
           ORDER BY is_featured DESC, display_order ASC, id ASC`,
          [propertyId],
        );
      } catch {
        videoRows = await query(
          `SELECT id, video_url, category, is_featured, display_order, created_at
           FROM property_videos
           WHERE property_id = ?
           ORDER BY is_featured DESC, display_order ASC, id ASC`,
          [propertyId],
        );
      }
      videos = videoRows.map((video) => {
        const category = normalizeImageCategory(video.category);
        return {
          ...video,
          thumbnail_url: video.thumbnail_url || null,
          thumbnail: video.thumbnail_url || null,
          category,
          category_label: category ? imageCategoryLabel(category) : null,
        };
      });
    } catch {
      videos = [];
    }

    const featuredVideo =
      videos.find((video) => video.is_featured) || videos[0] || null;
    const displayVideoUrl = featuredVideo?.video_url || null;

    return NextResponse.json({
      property: {
        ...property,
        video_url: displayVideoUrl,
        images,
        videos,
      },
    });
  } catch (err) {
    console.error("Failed to load property for review:", err);
    return NextResponse.json(
      { error: "Could not load this property." },
      { status: 500 },
    );
  }
}

export async function PATCH(req, { params }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const propertyId = Number(params.id);
  if (!propertyId) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requested = body?.status;
  if (!PROPERTY_STATUS_INPUTS.has(requested)) {
    return NextResponse.json(
      {
        error:
          "status must be draft, pending_approval, approved, rejected, sold, hidden, or active.",
      },
      { status: 400 },
    );
  }

  const nextStatus = toDbPropertyStatus(requested);
  if (nextStatus === PROPERTY_STATUS.SOLD) {
    return NextResponse.json(
      { error: "Only the listing agent can mark a property as sold." },
      { status: 403 },
    );
  }

  let reason = "";
  if (nextStatus === PROPERTY_STATUS.REJECTED) {
    const reasonCheck = validateRejectionReason(body?.rejected_reason);
    if (!reasonCheck.ok) {
      return NextResponse.json(
        { error: reasonCheck.error || "A rejection reason is required." },
        { status: 400 },
      );
    }
    reason = reasonCheck.value;
  }

  try {
    const rows = await query(
      `SELECT p.id, p.status, p.title,
              a.full_name AS agent_name, a.username AS agent_username,
              a.estate_name
       FROM properties p
       JOIN users a ON a.id = p.agent_id
       WHERE p.id = ?`,
      [propertyId],
    );
    if (!rows[0]) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    const property = rows[0];
    const reviewer = adminIdentity(session);
    const adminUserId = Number(session?.user?.id) || null;
    const adminName = session?.user?.name || "Superadmin";

    if (nextStatus === PROPERTY_STATUS.APPROVED) {
      await query(
        `UPDATE properties
         SET status = ?, approved_by = ?, approved_at = NOW(),
             rejected_reason = NULL, rejected_at = NULL, rejected_by = NULL
         WHERE id = ?`,
        [nextStatus, reviewer, propertyId],
      );
    } else if (nextStatus === PROPERTY_STATUS.REJECTED) {
      await query(
        `UPDATE properties
         SET status = ?, rejected_reason = ?, rejected_at = NOW(), rejected_by = ?,
             approved_by = NULL, approved_at = NULL
         WHERE id = ?`,
        [nextStatus, reason, reviewer, propertyId],
      );
    } else {
      await query("UPDATE properties SET status = ? WHERE id = ?", [
        nextStatus,
        propertyId,
      ]);
    }

    if (
      nextStatus === PROPERTY_STATUS.APPROVED ||
      nextStatus === PROPERTY_STATUS.REJECTED
    ) {
      const approved = nextStatus === PROPERTY_STATUS.APPROVED;
      await createAuditLog({
        userId: adminUserId,
        action: approved
          ? AUDIT_ACTIONS.PROPERTY_APPROVED
          : AUDIT_ACTIONS.PROPERTY_REJECTED,
        entityType: AUDIT_ENTITY_TYPES.PROPERTY,
        entityId: propertyId,
        description: approved
          ? `Approved property "${property.title}"`
          : `Rejected property "${property.title}"`,
        metadata: {
          property_title: property.title,
          agent_name: property.agent_name,
          agent_username: property.agent_username || property.estate_name,
          estate_name: property.estate_name,
          old_status: property.status,
          new_status: nextStatus,
          actor_name: adminName,
          ...(approved ? {} : { rejected_reason: reason }),
        },
        ipAddress: getRequestIp(req),
      });
    }

    return NextResponse.json({
      success: true,
      status: toClientPropertyStatus(nextStatus),
      dbStatus: nextStatus,
    });
  } catch (err) {
    console.error("Failed to update property status:", err);
    return NextResponse.json(
      { error: "Could not update property status." },
      { status: 500 },
    );
  }
}
