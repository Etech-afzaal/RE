import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import { PROPERTY_STATUS } from "@/lib/status";
import { rm } from "fs/promises";
import path from "path";

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
}

/** Statuses an agent may set on their own listing (never self-approve). */
const AGENT_SETTABLE_STATUSES = new Set([
  PROPERTY_STATUS.DRAFT,
  PROPERTY_STATUS.PENDING_APPROVAL,
  PROPERTY_STATUS.SOLD,
  PROPERTY_STATUS.HIDDEN,
]);

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

  const images = await query(
    "SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order ASC, id ASC",
    [propertyId],
  );

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
    "SELECT id, status FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  if (existing.length === 0) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  let nextStatus = existing[0].status;
  if (status != null) {
    if (!AGENT_SETTABLE_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "You cannot set that property status." },
        { status: 400 },
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
  const agentId = agentIdFrom(session);
  const existing = await query(
    "SELECT id FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  if (existing.length === 0) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

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

  return NextResponse.json({ success: true, deleted: true });
}
