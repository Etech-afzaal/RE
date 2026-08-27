import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  archiveSubagent,
  getSubagentForAgent,
  updateSubagent,
} from "@/lib/subagents";
import { validateSubagentInput } from "@/lib/validators/subagentValidator";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const subagentId = Number(params.id);

  if (!Number.isInteger(subagentId) || subagentId <= 0) {
    return NextResponse.json({ error: "Invalid subagent." }, { status: 400 });
  }

  const subagent = await getSubagentForAgent(agentId, subagentId);
  if (!subagent) {
    return NextResponse.json({ error: "Subagent not found." }, { status: 404 });
  }

  return NextResponse.json({ subagent });
}

export async function PATCH(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const subagentId = Number(params.id);

  if (!Number.isInteger(subagentId) || subagentId <= 0) {
    return NextResponse.json({ error: "Invalid subagent." }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validated = validateSubagentInput(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const result = await updateSubagent(agentId, subagentId, {
    ...validated.data,
    image: body?.image !== undefined ? body.image : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const subagent = await getSubagentForAgent(agentId, subagentId);
  return NextResponse.json({ success: true, subagent });
}

export async function DELETE(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const subagentId = Number(params.id);

  if (!Number.isInteger(subagentId) || subagentId <= 0) {
    return NextResponse.json({ error: "Invalid subagent." }, { status: 400 });
  }

  const result = await archiveSubagent(agentId, subagentId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
