import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import {
  imageCategoryLabel,
  normalizeImageCategory,
} from "@/lib/imageCategories";
import {
  canAgentTransition,
  isPropertyLockedForAgent,
  PROPERTY_DB_STATUSES,
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

  return NextResponse.json({ property: { ...property, images } });
}

export async function PUT(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  const body = await req.json();
  const { title, description, size_value, size_unit, price, location, status } =
    body;

  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const agentId = agentIdFrom(session);
  const existing = await query(
    "SELECT id, status, approved_at FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  if (existing.length === 0) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const current = existing[0];
  if (isPropertyLockedForAgent(current.status)) {
    return NextResponse.json(
      {
        error:
          "This property is awaiting admin review and cannot be edited right now.",
      },
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

  await query(
    `UPDATE properties
     SET title = ?, description = ?, size_value = ?, size_unit = ?, price = ?,
         location = ?, status = ?
     WHERE id = ? AND agent_id = ?`,
    [
      String(title).trim(),
      description || null,
      size_value || null,
      size_unit || "marla",
      price || null,
      location || null,
      nextStatus,
      propertyId,
      agentId,
    ],
  );

  return NextResponse.json({ success: true, status: nextStatus });
}

export async function DELETE(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }
  const agentId = agentIdFrom(session);
  const existing = await query(
    "SELECT id FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  if (existing.length === 0) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

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

  return NextResponse.json({ success: true, deleted: true });
}
