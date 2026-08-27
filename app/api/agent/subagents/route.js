import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  createSubagent,
  listSubagentsForAgent,
  MAX_SUBAGENTS_PER_AGENT,
} from "@/lib/subagents";
import { validateSubagentInput } from "@/lib/validators/subagentValidator";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const subagents = await listSubagentsForAgent(agentId, { includeInactive: true });

  return NextResponse.json({
    subagents,
    max: MAX_SUBAGENTS_PER_AGENT,
    count: subagents.filter((s) => s.is_active).length,
  });
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

  return NextResponse.json({ success: true, id: result.id });
}
