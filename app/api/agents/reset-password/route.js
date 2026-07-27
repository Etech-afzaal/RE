import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";

export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const { newPassword } = await req.json();

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const agentId = Number(session.user.agent_id || session.user.id);

  await query(
    "UPDATE agents SET password_hash = ?, must_reset_password = FALSE WHERE id = ?",
    [passwordHash, agentId],
  );

  return NextResponse.json({ success: true });
}
