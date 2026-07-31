import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import {
  AGENT_STATUS,
  AGENT_STATUS_INPUTS,
  toClientAgentStatus,
  toDbAgentStatus,
} from "@/lib/status";

export async function PATCH(req, { params }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const agentId = Number(params.id);
  if (!agentId) {
    return NextResponse.json({ error: "Invalid agent id." }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requested = body?.status;
  if (!AGENT_STATUS_INPUTS.has(requested)) {
    return NextResponse.json(
      {
        error:
          "status must be active, approved, pending, rejected, disabled, or blocked.",
      },
      { status: 400 },
    );
  }

  const nextStatus = toDbAgentStatus(requested);
  const blockedReason = String(body?.blocked_reason || "").trim();

  if (nextStatus === AGENT_STATUS.BLOCKED && !blockedReason) {
    return NextResponse.json(
      { error: "A reason is required to permanently block an agent." },
      { status: 400 },
    );
  }

  try {
    const agents = await query(
      "SELECT id, email, status FROM agents WHERE id = ?",
      [agentId],
    );
    const agent = agents[0];
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const reviewer =
      session?.user?.email || session?.user?.name || "superadmin";

    if (nextStatus === AGENT_STATUS.BLOCKED) {
      await query(
        `UPDATE agents
         SET status = ?,
             blocked_reason = ?,
             blocked_at = NOW(),
             blocked_by = ?
         WHERE id = ?`,
        [nextStatus, blockedReason, reviewer, agentId],
      );
    } else {
      // Enabling or temporarily disabling clears any prior block record.
      await query(
        `UPDATE agents
         SET status = ?,
             blocked_reason = NULL,
             blocked_at = NULL,
             blocked_by = NULL
         WHERE id = ?`,
        [nextStatus, agentId],
      );
    }

    // Keep the matching signup request in sync for approved / revoked flows.
    if (
      nextStatus === AGENT_STATUS.APPROVED ||
      nextStatus === AGENT_STATUS.DISABLED ||
      nextStatus === AGENT_STATUS.BLOCKED
    ) {
      const requestStatus =
        nextStatus === AGENT_STATUS.APPROVED ? "approved" : "revoked";
      await query(
        `UPDATE signup_requests
         SET status = ?
         WHERE email = ?
           AND status IN ('approved', 'revoked')`,
        [requestStatus, agent.email],
      );
    }

    const [updated] = await query(
      `SELECT status, blocked_reason, blocked_at, blocked_by
       FROM agents WHERE id = ?`,
      [agentId],
    );

    return NextResponse.json({
      success: true,
      status: toClientAgentStatus(updated.status),
      blocked_reason: updated.blocked_reason,
      blocked_at: updated.blocked_at,
      blocked_by: updated.blocked_by,
    });
  } catch (err) {
    console.error("Failed to update agent status:", err);
    return NextResponse.json(
      { error: "Could not update agent status." },
      { status: 500 },
    );
  }
}
