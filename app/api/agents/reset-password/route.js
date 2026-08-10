import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import { validateNewPassword } from "@/lib/validators/userValidator";

export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const { newPassword } = await req.json();
  const passwordCheck = validateNewPassword(newPassword);
  if (!passwordCheck.ok) {
    return NextResponse.json(
      { error: passwordCheck.error },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const agentId = Number(session.user.agent_id || session.user.id);

  await query(
    "UPDATE users SET password_hash = ?, must_reset_password = FALSE WHERE id = ? AND user_type = 'agent'",
    [passwordHash, agentId],
  );

  return NextResponse.json({ success: true });
}
