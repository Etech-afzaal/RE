import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import {
  AGENT_STATUS_INPUTS,
  toClientAgentStatus,
  toDbAgentStatus,
} from "@/lib/status";

export async function PATCH(req, { params }) {
  const { error } = await requireAdmin();
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
          "status must be active, approved, pending, rejected, or disabled.",
      },
      { status: 400 },
    );
  }

  const nextStatus = toDbAgentStatus(requested);

  try {
    const agents = await query(
      "SELECT id, email, status FROM agents WHERE id = ?",
      [agentId],
    );
    const agent = agents[0];
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    await query("UPDATE agents SET status = ? WHERE id = ?", [
      nextStatus,
      agentId,
    ]);

    const requestStatus = nextStatus === "approved" ? "approved" : "revoked";
    if (nextStatus === "approved" || nextStatus === "disabled") {
      await query(
        `UPDATE signup_requests
         SET status = ?
         WHERE email = ?
           AND status IN ('approved', 'revoked')`,
        [requestStatus, agent.email],
      );
    }

    return NextResponse.json({
      success: true,
      status: toClientAgentStatus(nextStatus),
    });
  } catch (err) {
    console.error("Failed to update agent status:", err);
    return NextResponse.json(
      { error: "Could not update agent status." },
      { status: 500 },
    );
  }
}
