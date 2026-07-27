import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import {
  PROPERTY_STATUS,
  PROPERTY_STATUS_INPUTS,
  toClientPropertyStatus,
  toDbPropertyStatus,
} from "@/lib/status";

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

  try {
    const rows = await query("SELECT id, status FROM properties WHERE id = ?", [
      propertyId,
    ]);
    if (!rows[0]) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    if (nextStatus === PROPERTY_STATUS.APPROVED) {
      await query(
        `UPDATE properties
         SET status = ?, approved_by = ?, approved_at = NOW(), rejected_reason = NULL
         WHERE id = ?`,
        [nextStatus, "admin", propertyId],
      );
    } else if (nextStatus === PROPERTY_STATUS.REJECTED) {
      const reason =
        typeof body?.rejected_reason === "string" ? body.rejected_reason : null;
      await query(
        `UPDATE properties
         SET status = ?, rejected_reason = ?
         WHERE id = ?`,
        [nextStatus, reason, propertyId],
      );
    } else {
      await query("UPDATE properties SET status = ? WHERE id = ?", [
        nextStatus,
        propertyId,
      ]);
    }

    return NextResponse.json({
      success: true,
      status: toClientPropertyStatus(nextStatus),
    });
  } catch (err) {
    console.error("Failed to update property status:", err);
    return NextResponse.json(
      { error: "Could not update property status." },
      { status: 500 },
    );
  }
}
