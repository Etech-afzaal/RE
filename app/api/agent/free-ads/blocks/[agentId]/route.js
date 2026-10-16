import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  agentExists,
  agentIdFromSession,
  blockFreeAdsOnHost,
  unblockFreeAdsOnHost,
} from "@/lib/freeAds";

function targetAgentId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function validateTarget(session, params) {
  const advertiserAgentId = agentIdFromSession(session);
  const hostAgentId = targetAgentId(params.agentId);
  if (!hostAgentId) {
    return { error: NextResponse.json({ error: "Invalid agent." }, { status: 400 }) };
  }
  if (hostAgentId === advertiserAgentId) {
    return {
      error: NextResponse.json(
        { error: "You cannot block free ads on your own website." },
        { status: 400 },
      ),
    };
  }
  if (!(await agentExists(hostAgentId))) {
    return { error: NextResponse.json({ error: "Agent not found." }, { status: 404 }) };
  }
  return { advertiserAgentId, hostAgentId, error: null };
}

// Agent A blocks Agent B by adding A -> B. Later, the serving layer excludes
// A-owned free ads only while rendering B's public website.
export async function POST(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const target = await validateTarget(session, params);
  if (target.error) return target.error;
  await blockFreeAdsOnHost(target.advertiserAgentId, target.hostAgentId);
  return NextResponse.json({ success: true, isBlocked: true });
}

export async function DELETE(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const target = await validateTarget(session, params);
  if (target.error) return target.error;
  await unblockFreeAdsOnHost(target.advertiserAgentId, target.hostAgentId);
  return NextResponse.json({ success: true, isBlocked: false });
}
