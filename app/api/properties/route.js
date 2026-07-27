import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import { getPropertiesByAgentId } from "@/lib/queries";

export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = Number(session.user.agent_id || session.user.id);
  const properties = await getPropertiesByAgentId(agentId);
  return NextResponse.json({ properties });
}

export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = Number(session.user.agent_id || session.user.id);
  const body = await req.json();
  const { title, description, size_value, size_unit, price, location } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO properties (agent_id, title, description, size_value, size_unit, price, location)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      agentId,
      title,
      description || null,
      size_value || null,
      size_unit || "marla",
      price || null,
      location || null,
    ],
  );

  return NextResponse.json({ success: true, propertyId: result.insertId });
}
