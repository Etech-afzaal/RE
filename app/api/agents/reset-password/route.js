import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import { validateNewPassword } from "@/lib/validators/userValidator";

export async function POST(req) {
  // Forced temp-password reset must still work when mustResetPassword is true.
  const { session, error } = await requireAgent({ allowPasswordReset: true });
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { newPassword, currentPassword } = body;
  const passwordCheck = validateNewPassword(newPassword);
  if (!passwordCheck.ok) {
    return NextResponse.json(
      { error: passwordCheck.error },
      { status: 400 },
    );
  }

  const agentId = Number(session.user.agent_id || session.user.id);
  const rows = await query(
    "SELECT password_hash, must_reset_password FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
    [agentId],
  );
  const agent = rows[0];
  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const mustReset = Boolean(agent.must_reset_password);
  // Voluntary password change (settings) requires the current password.
  // Forced reset after a temp password may omit it.
  if (!mustReset) {
    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json(
        { error: "Current password is required." },
        { status: 400 },
      );
    }
    const matches = await bcrypt.compare(currentPassword, agent.password_hash);
    if (!matches) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );
    }
  }

  const passwordHash = await bcrypt.hash(passwordCheck.value, 10);

  await query(
    "UPDATE users SET password_hash = ?, must_reset_password = FALSE WHERE id = ? AND user_type = 'agent'",
    [passwordHash, agentId],
  );

  return NextResponse.json({ success: true });
}
