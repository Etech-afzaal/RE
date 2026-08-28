import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import { listMarketingLinksForProperty } from "@/lib/marketingLinks";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const propertyId = Number(params.id);

  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return NextResponse.json({ error: "Invalid property." }, { status: 400 });
  }

  try {
    const propertyRows = await query(
      "SELECT id, agent_id FROM properties WHERE id = ? AND agent_id = ? LIMIT 1",
      [propertyId, agentId],
    );

    if (!propertyRows[0]) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    const agentRows = await query(
      "SELECT username, estate_name FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
      [agentId],
    );
    const agentUsername =
      agentRows[0]?.username || agentRows[0]?.estate_name || "";

    const links = await listMarketingLinksForProperty(
      agentId,
      propertyId,
      agentUsername,
    );

    return NextResponse.json({ links });
  } catch (err) {
    console.error("Failed to load property marketing links:", err);
    return NextResponse.json(
      { error: "Could not load property links." },
      { status: 500 },
    );
  }
}
