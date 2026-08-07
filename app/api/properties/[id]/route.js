import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";
import {
  imageCategoryLabel,
  normalizeImageCategory,
} from "@/lib/imageCategories";
import { normalizeLocationFields } from "@/lib/propertyLocation";
import {
  canAgentTransition,
  isPropertyLockedForAgent,
  PROPERTY_DB_STATUSES,
  PROPERTY_LOCKED_MESSAGE,
  PROPERTY_STATUS,
} from "@/lib/status";
import { rm } from "fs/promises";
import path from "path";

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const rows = await query(
    "SELECT * FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentIdFrom(session)],
  );
  const property = rows[0];

  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const imageRows = await query(
    "SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order ASC, id ASC",
    [propertyId],
  );
  const images = imageRows.map((image) => {
    const category = normalizeImageCategory(image.category);
    return { ...image, category, category_label: imageCategoryLabel(category) };
  });

  let videos = [];
  try {
    const videoRows = await query(
      `SELECT id, video_url, category, is_featured, display_order
       FROM property_videos
       WHERE property_id = ?
       ORDER BY is_featured DESC, display_order ASC, id ASC`,
      [propertyId],
    );
    videos = videoRows;
  } catch {
    videos = [];
  }

  const featuredVideo =
    videos.find((video) => video.is_featured) || videos[0] || null;
  const displayVideoUrl =
    featuredVideo?.video_url || property.video_url || null;

  return NextResponse.json({
    property: {
      ...property,
      video_url: displayVideoUrl,
      images,
      videos,
    },
  });
}

export async function PUT(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const body = await req.json();
  const { title, description, size_value, size_unit, price, status } = body;
  const locationFields = normalizeLocationFields(body);

  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const agentId = agentIdFrom(session);
  const existing = await query(
    "SELECT id, status, approved_at, title FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  if (existing.length === 0) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const current = existing[0];
  if (isPropertyLockedForAgent(current.status)) {
    return NextResponse.json(
      { error: PROPERTY_LOCKED_MESSAGE },
      { status: 409 },
    );
  }

  let nextStatus = current.status;
  if (status != null && status !== current.status) {
    if (!PROPERTY_DB_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Unknown property status." },
        { status: 400 },
      );
    }
    if (status === PROPERTY_STATUS.PENDING_APPROVAL) {
      return NextResponse.json(
        {
          error:
            "Use the submit-for-approval action so the listing can be validated first.",
        },
        { status: 400 },
      );
    }
    // Re-listing is only for something an admin already cleared once.
    if (status === PROPERTY_STATUS.APPROVED && !current.approved_at) {
      return NextResponse.json(
        { error: "Only an admin can approve a property." },
        { status: 403 },
      );
    }
    if (!canAgentTransition(current.status, status)) {
      return NextResponse.json(
        { error: "You cannot set that property status." },
        { status: 403 },
      );
    }
    nextStatus = status;
  }

  const trimmedTitle = String(title).trim();

  if (locationFields.hasStructured) {
    await query(
      `UPDATE properties
       SET title = ?, description = ?, size_value = ?, size_unit = ?, price = ?,
           location = ?, city = ?, area = ?, phase = ?, address = ?, status = ?
       WHERE id = ? AND agent_id = ?`,
      [
        trimmedTitle,
        description || null,
        size_value || null,
        size_unit || "marla",
        price || null,
        locationFields.location,
        locationFields.city,
        locationFields.area,
        locationFields.phase,
        locationFields.address,
        nextStatus,
        propertyId,
        agentId,
      ],
    );
  } else {
    await query(
      `UPDATE properties
       SET title = ?, description = ?, size_value = ?, size_unit = ?, price = ?,
           location = ?, status = ?
       WHERE id = ? AND agent_id = ?`,
      [
        trimmedTitle,
        description || null,
        size_value || null,
        size_unit || "marla",
        price || null,
        locationFields.location,
        nextStatus,
        propertyId,
        agentId,
      ],
    );
  }

  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.PROPERTY_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    description: `${agentName} updated property "${trimmedTitle}"`,
    metadata: {
      property_title: trimmedTitle,
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      old_status: current.status,
      new_status: nextStatus,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true, status: nextStatus });
}

export async function DELETE(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }
  const agentId = agentIdFrom(session);
  const existing = await query(
    "SELECT id, title, status FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  if (existing.length === 0) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
  if (isPropertyLockedForAgent(existing[0].status)) {
    return NextResponse.json(
      { error: PROPERTY_LOCKED_MESSAGE },
      { status: 409 },
    );
  }
  const propertyTitle = existing[0].title;

  try {
    await query("DELETE FROM property_images WHERE property_id = ?", [
      propertyId,
    ]);
    await query("DELETE FROM properties WHERE id = ? AND agent_id = ?", [
      propertyId,
      agentId,
    ]);

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      String(propertyId),
    );
    await rm(uploadDir, { recursive: true, force: true });
    const videoUploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "videos",
      String(propertyId),
    );
    await rm(videoUploadDir, { recursive: true, force: true });
  } catch (err) {
    console.error("Failed to delete property:", err);
    return NextResponse.json(
      { error: "Could not delete property. Please try again." },
      { status: 500 },
    );
  }

  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.PROPERTY_DELETED,
    entityType: AUDIT_ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    description: `${agentName} deleted property "${propertyTitle}"`,
    metadata: {
      property_title: propertyTitle,
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true, deleted: true });
}
