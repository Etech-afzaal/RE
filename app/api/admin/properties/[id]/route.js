import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

const ALLOWED = new Set(["active", "sold", "draft"]);

export async function PATCH(req, { params }) {
  const { error } = await requireAdmin();
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

  const nextStatus = body?.status;
  if (!ALLOWED.has(nextStatus)) {
    return NextResponse.json(
      { error: "status must be active, sold, or draft." },
      { status: 400 },
    );
  }

  try {
    const rows = await query("SELECT id, status FROM properties WHERE id = ?", [
      propertyId,
    ]);
    if (!rows[0]) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    await query("UPDATE properties SET status = ? WHERE id = ?", [
      nextStatus,
      propertyId,
    ]);

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error("Failed to update property status:", err);
    return NextResponse.json(
      { error: "Could not update property status." },
      { status: 500 },
    );
  }
}
