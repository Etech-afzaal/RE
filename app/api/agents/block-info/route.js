import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { AGENT_STATUS } from "@/lib/status";

/**
 * Public lookup used after a blocked login attempt so the login page can show
 * the admin's reason. Only returns data when the account is actually blocked —
 * other statuses get a generic response so this cannot be used to inspect
 * active agents.
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const rows = await query(
    `SELECT status, blocked_reason, blocked_at
     FROM agents WHERE email = ? LIMIT 1`,
    [email],
  );
  const agent = rows[0];

  if (!agent || agent.status !== AGENT_STATUS.BLOCKED) {
    return NextResponse.json({ blocked: false });
  }

  return NextResponse.json({
    blocked: true,
    reason: agent.blocked_reason || "No reason was recorded.",
    blocked_at: agent.blocked_at,
  });
}
