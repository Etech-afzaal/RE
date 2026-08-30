import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { createSubagent, getSubagentsPageByAgent } from "@/lib/subagents";
import { validateSubagentInput } from "@/lib/validators/subagentValidator";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
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

  return NextResponse.json({ success: true, id: result.id });
}
