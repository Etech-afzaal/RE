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
import { validatePropertyDraftInput } from "@/lib/validators/propertyValidator";
import { normalizeMarketingSections } from "@/lib/propertyMarketingSections";
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
}

export async function PUT(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const body = await req.json();
  const validated = validatePropertyDraftInput(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const marketing = normalizeMarketingSections(body);
  if (!marketing.ok) {
    return NextResponse.json({ error: marketing.error }, { status: 400 });
  }
  const {
    property_highlights,
    why_this_home,
    location_advantages,
    investment_insights,
  } = marketing.data;

  const {
    title,
    description,
    size_value,
    size_unit,
    price,
    price_currency,
    property_type,
    property_subtype,
  } = validated.data;
  const status = body.status;
  const locationFields = normalizeLocationFields({
    ...body,
    ...validated.data,
  });

  const agentId = agentIdFrom(session);
  const existing = await query(
    "SELECT id, status, approved_at, title, price_currency, property_type, property_subtype FROM properties WHERE id = ? AND agent_id = ?",
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
  const nextCurrency = price_currency || current.price_currency || "PKR";
  const typeProvided =
    body.propertyType != null ||
    body.property_type != null ||
    body.propertySubtype != null ||
    body.property_subtype != null;
  const resolvedType = typeProvided
    ? property_type || validated.data.propertyType || null
    : current.property_type || null;
  const resolvedSubtype = typeProvided
    ? property_subtype || validated.data.propertySubtype || null
    : current.property_subtype || null;

  const marketingSQL = `, property_highlights = ?, why_this_home = ?, location_advantages = ?, investment_insights = ?`;
  const marketingParams = [
    property_highlights ? JSON.stringify(property_highlights) : null,
    why_this_home ? JSON.stringify(why_this_home) : null,
    location_advantages ? JSON.stringify(location_advantages) : null,
    investment_insights ? JSON.stringify(investment_insights) : null,
  ];

  if (locationFields.hasStructured) {
    await query(
      `UPDATE properties
       SET title = ?, property_type = ?, property_subtype = ?, description = ?, size_value = ?, size_unit = ?, price = ?,
           price_currency = ?, location = ?, city = ?, area = ?, phase = ?,
           address = ?, status = ?${marketingSQL}
       WHERE id = ? AND agent_id = ?`,
      [
        trimmedTitle,
        resolvedType,
        resolvedSubtype,
        description || null,
        size_value ?? null,
        size_unit || "marla",
        price ?? null,
        nextCurrency,
        locationFields.location,
        locationFields.city,
        locationFields.area,
        locationFields.phase,
        locationFields.address,
        nextStatus,
        ...marketingParams,
        propertyId,
        agentId,
      ],
    );
  } else {
    await query(
      `UPDATE properties
       SET title = ?, property_type = ?, property_subtype = ?, description = ?, size_value = ?, size_unit = ?, price = ?,
           price_currency = ?, location = ?, status = ?${marketingSQL}
       WHERE id = ? AND agent_id = ?`,
      [
        trimmedTitle,
        resolvedType,
        resolvedSubtype,
        description || null,
        size_value ?? null,
        size_unit || "marla",
        price ?? null,
        nextCurrency,
        locationFields.location,
        nextStatus,
        ...marketingParams,
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

export async function PATCH(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body?.status !== PROPERTY_STATUS.SOLD) {
    return NextResponse.json(
      { error: "Only marking a property as sold is allowed." },
      { status: 400 },
    );
  }

  const agentId = agentIdFrom(session);
  const existing = await query(
    "SELECT id, status, title FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  if (existing.length === 0) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const current = existing[0];
  if (current.status === PROPERTY_STATUS.SOLD) {
    return NextResponse.json({ success: true, status: PROPERTY_STATUS.SOLD });
  }
  if (!canAgentTransition(current.status, PROPERTY_STATUS.SOLD)) {
    return NextResponse.json(
      { error: "Only an approved listing can be marked as sold." },
      { status: 403 },
    );
  }

  await query("UPDATE properties SET status = ? WHERE id = ? AND agent_id = ?", [
    PROPERTY_STATUS.SOLD,
    propertyId,
    agentId,
  ]);

  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.PROPERTY_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    description: `${agentName} marked property "${current.title}" as sold`,
    metadata: {
      property_title: current.title,
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      old_status: current.status,
      new_status: PROPERTY_STATUS.SOLD,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true, status: PROPERTY_STATUS.SOLD });
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
    await query("DELETE FROM property_videos WHERE property_id = ?", [
      propertyId,
    ]).catch(() => {});
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