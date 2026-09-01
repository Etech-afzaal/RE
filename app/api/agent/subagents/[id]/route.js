import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import {
  archiveSubagent,
  getSubagentForAgent,
  updateSubagent,
} from "@/lib/subagents";
import { validateSubagentInput } from "@/lib/validators/subagentValidator";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

function agentDisplayName(session) {
  return (
    session?.user?.name ||
    session?.user?.full_name ||
    session?.user?.email ||
    "Agent"
  );
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
  const actorName = agentDisplayName(session);
  const subagentName = String(subagent?.name || validated.data.name || "Subagent").trim();

  await createAuditLog({
    userId: Number(session?.user?.id) || null,
    action: AUDIT_ACTIONS.SUBAGENT_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.SUBAGENT,
    entityId: subagentId,
    description: `${actorName} updated subagent ${subagentName}`,
    metadata: {
      actor_name: actorName,
      agent_name: actorName,
      subagent_name: subagentName,
      subagent_id: subagentId,
    },
    ipAddress: getRequestIp(req),
  });

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

  const existing = await getSubagentForAgent(agentId, subagentId);
  if (!existing) {
    return NextResponse.json({ error: "Subagent not found." }, { status: 404 });
  }

  const result = await archiveSubagent(agentId, subagentId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const actorName = agentDisplayName(session);
  const subagentName = String(existing.name || "Subagent").trim();

  await createAuditLog({
    userId: Number(session?.user?.id) || null,
    action: AUDIT_ACTIONS.SUBAGENT_DELETED,
    entityType: AUDIT_ENTITY_TYPES.SUBAGENT,
    entityId: subagentId,
    description: `${actorName} removed subagent ${subagentName}`,
    metadata: {
      actor_name: actorName,
      agent_name: actorName,
      subagent_name: subagentName,
      subagent_id: subagentId,
    },
    ipAddress: getRequestIp(_req),
  });

  return NextResponse.json({ success: true });
}
