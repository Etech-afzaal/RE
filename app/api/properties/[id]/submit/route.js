import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";
import { validatePropertyForSubmission } from "@/lib/propertyValidation";
import { canAgentSubmitFrom, PROPERTY_STATUS } from "@/lib/status";

/**
 * Submit one of the agent's own listings for admin review.
 * This is the only way a listing can reach pending_approval, so completeness is
 * checked here rather than trusting whatever status the client asks for.
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
    "SELECT * FROM properties WHERE id = ? AND agent_id = ?",
    [propertyId, agentId],
  );
  const property = rows[0];
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  if (property.status === PROPERTY_STATUS.PENDING_APPROVAL) {
    return NextResponse.json(
      { error: "This property is already awaiting admin review." },
      { status: 409 },
    );
  }

  if (!canAgentSubmitFrom(property.status)) {
    return NextResponse.json(
      { error: "Only draft or rejected properties can be submitted for approval." },
      { status: 409 },
    );
  }

  const imageRows = await query(
    "SELECT COUNT(*) AS total FROM property_images WHERE property_id = ?",
    [propertyId],
  );
  const { valid, errors } = validatePropertyForSubmission(
    property,
    Number(imageRows[0]?.total) || 0,
  );
  if (!valid) {
    return NextResponse.json(
      { error: "This property is not ready for review.", errors },
      { status: 422 },
    );
  }

  await query(
    `UPDATE properties
     SET status = ?, submitted_at = NOW(),
         rejected_reason = NULL, rejected_at = NULL, rejected_by = NULL
     WHERE id = ? AND agent_id = ?
       AND status IN (?, ?)`,
    [
      PROPERTY_STATUS.PENDING_APPROVAL,
      propertyId,
      agentId,
      PROPERTY_STATUS.DRAFT,
      PROPERTY_STATUS.REJECTED,
    ],
  );

  // Re-read so a concurrent admin status change is not reported as pending.
  const [fresh] = await query(
    "SELECT status FROM properties WHERE id = ? AND agent_id = ? LIMIT 1",
    [propertyId, agentId],
  );
  if (!fresh || fresh.status !== PROPERTY_STATUS.PENDING_APPROVAL) {
    return NextResponse.json(
      {
        error:
          "Could not submit this property because its status changed. Please refresh and try again.",
      },
      { status: 409 },
    );
  }

  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.PROPERTY_SUBMITTED,
    entityType: AUDIT_ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    description: `${agentName} submitted property "${property.title}" for approval`,
    metadata: {
      property_title: property.title,
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      old_status: property.status,
      new_status: PROPERTY_STATUS.PENDING_APPROVAL,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({
    success: true,
    status: PROPERTY_STATUS.PENDING_APPROVAL,
    message: "Property submitted for approval.",
  });
}
