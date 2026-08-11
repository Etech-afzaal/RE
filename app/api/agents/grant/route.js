import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";

export async function POST(req) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { requestId } = await req.json();
  if (!requestId) {
    return NextResponse.json(
      { error: "requestId is required." },
      { status: 400 },
    );
  }

  try {
    const requests = await query(
      "SELECT * FROM signup_requests WHERE id = ? AND status = 'revoked'",
      [requestId],
    );
    const signupRequest = requests[0];
    if (!signupRequest) {
      return NextResponse.json(
        { error: "Request not found or not currently revoked." },
        { status: 404 },
      );
    }

    const agentRows = await query(
      `SELECT id, full_name, username, estate_name, status
       FROM users WHERE email = ? AND user_type = 'agent' LIMIT 1`,
      [signupRequest.email],
    );
    const agent = agentRows[0];
    if (!agent) {
      return NextResponse.json(
        { error: "Matching agent account was not found." },
        { status: 404 },
      );
    }
    if (agent.status === "blocked") {
      return NextResponse.json(
        {
          error:
            "This agent is permanently blocked. Unblock them from Agent Management first.",
        },
        { status: 409 },
      );
    }

    // Re-enable only disabled agents (revoke flow). Never clear a block here.
    await query(
      `UPDATE users
       SET status = 'approved'
       WHERE id = ? AND user_type = 'agent' AND status = 'disabled'`,
      [agent.id],
    );

    await query("UPDATE signup_requests SET status = 'approved' WHERE id = ?", [
      requestId,
    ]);

    await createAuditLog({
      userId: Number(session?.user?.id) || null,
      action: AUDIT_ACTIONS.AGENT_ENABLED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: agent.id,
      description: `Re-enabled agent ${signupRequest.full_name}`,
      metadata: {
        actor_name: session?.user?.name || "Superadmin",
        agent_name: signupRequest.full_name,
        agent_username: agent.username || agent.estate_name || signupRequest.estate_name,
        estate_name: signupRequest.estate_name,
        signup_request_id: Number(requestId),
      },
      ipAddress: getRequestIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to grant signup request:", err);
    return NextResponse.json(
      { error: "Could not grant this request. Please try again later." },
      { status: 500 },
    );
  }
}
