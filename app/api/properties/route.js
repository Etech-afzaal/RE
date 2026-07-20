import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { getPropertiesByAgentId } from "@/lib/queries";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "agent") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const properties = await getPropertiesByAgentId(Number(session.user.id));
  return NextResponse.json({ properties });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "agent") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const agentId = Number(session.user.id);
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
