import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";
import { PROPERTY_STATUS } from "@/lib/status";

/**
 * Agent cancels their own pending approval request.
 * Returns the listing to draft so it can be edited and resubmitted.
 * Atomic WHERE status = pending_approval so a concurrent admin review wins.
 */
export async function POST(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const propertyId = Number(params.id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  const agentId = Number(session.user.agent_id || session.user.id);
  const rows = await query(
    "SELECT id, title, status FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  const property = rows[0];
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  if (property.status !== PROPERTY_STATUS.PENDING_APPROVAL) {
    return NextResponse.json(
      {
        error:
          "This property has already been reviewed and can no longer be cancelled.",
      },
      { status: 409 },
    );
  }

  const result = await query(
    `UPDATE properties
     SET status = ?, submitted_at = NULL
     WHERE id = ? AND agent_id = ? AND status = ?`,
    [
      PROPERTY_STATUS.DRAFT,
      propertyId,
      agentId,
      PROPERTY_STATUS.PENDING_APPROVAL,
    ],
  );

  if (!result.affectedRows) {
    return NextResponse.json(
      {
        error:
          "This property has already been reviewed and can no longer be cancelled.",
      },
      { status: 409 },
    );
  }

  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.PROPERTY_APPROVAL_CANCELLED,
    entityType: AUDIT_ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    description: `${agentName} cancelled the approval request for "${property.title}"`,
    metadata: {
      property_title: property.title,
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      old_status: PROPERTY_STATUS.PENDING_APPROVAL,
      new_status: PROPERTY_STATUS.DRAFT,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({
    success: true,
    status: PROPERTY_STATUS.DRAFT,
    message: "Approval request cancelled. Property returned to draft.",
  });
}
