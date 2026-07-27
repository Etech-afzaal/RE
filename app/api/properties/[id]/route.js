import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
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
  const { title, description, size_value, size_unit, price, location } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const agentId = agentIdFrom(session);
  const existing = await query(
    "SELECT id FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  if (existing.length === 0) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  await query(
    `UPDATE properties SET title = ?, description = ?, size_value = ?, size_unit = ?, price = ?, location = ? WHERE id = ? AND agent_id = ?`,
    [
      title,
      description || null,
      size_value || null,
      size_unit || "marla",
      price || null,
      location || null,
      propertyId,
      agentId,
    ],
  );

  return NextResponse.json({ success: true });
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

  return NextResponse.json({ success: true, deleted: true });
}
