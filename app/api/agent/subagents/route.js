import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { createSubagent, getSubagentsPageByAgent } from "@/lib/subagents";
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

export async function GET(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page");

  const payload = await getSubagentsPageByAgent(agentId, {
    page,
    pageSize: 10,
  });

  return NextResponse.json(payload);
}

export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
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

  const result = await createSubagent(agentId, {
    ...validated.data,
    image: body?.image || null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const subagentName = String(validated.data.name || "Subagent").trim();
  const actorName = agentDisplayName(session);

  await createAuditLog({
    userId: Number(session?.user?.id) || null,
    action: AUDIT_ACTIONS.SUBAGENT_CREATED,
    entityType: AUDIT_ENTITY_TYPES.SUBAGENT,
    entityId: result.id,
    description: `${actorName} added subagent ${subagentName}`,
    metadata: {
      actor_name: actorName,
      agent_name: actorName,
      subagent_name: subagentName,
      subagent_id: result.id,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true, id: result.id });
}
