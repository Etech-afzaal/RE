import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  getManagedPropertiesByAgent,
  getAgentPropertyStats,
} from "@/lib/queries";
import { query } from "@/lib/db";
import { PROPERTY_STATUS } from "@/lib/status";

const AGENT_CREATABLE_STATUSES = new Set([
  PROPERTY_STATUS.DRAFT,
  PROPERTY_STATUS.PENDING_APPROVAL,
]);

export async function GET(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = Number(session.user.agent_id || session.user.id);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const includeStats = searchParams.get("stats") === "1";

  let properties = await getManagedPropertiesByAgent(agentId);
  if (status && status !== "all") {
    properties = properties.filter((p) => p.status === status);
  }

  const payload = { properties };
  if (includeStats) {
    payload.stats = await getAgentPropertyStats(agentId);
  }
  return NextResponse.json(payload);
}

export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = Number(session.user.agent_id || session.user.id);
  const body = await req.json();
  const {
    title,
    description,
    size_value,
    size_unit,
    price,
    location,
    status: requestedStatus,
  } = body;

  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const status = AGENT_CREATABLE_STATUSES.has(requestedStatus)
    ? requestedStatus
    : PROPERTY_STATUS.DRAFT;

  const result = await query(
    `INSERT INTO properties
      (agent_id, title, description, size_value, size_unit, price, location, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agentId,
      String(title).trim(),
      description || null,
      size_value || null,
      size_unit || "marla",
      price || null,
      location || null,
      status,
    ],
  );

  return NextResponse.json({
    success: true,
    propertyId: result.insertId,
    status,
  });
}
