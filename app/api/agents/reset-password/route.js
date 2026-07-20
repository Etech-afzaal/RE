import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "agent") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { newPassword } = await req.json();

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await query(
    "UPDATE agents SET password_hash = ?, must_reset_password = FALSE WHERE id = ?",
    [passwordHash, Number(session.user.id)]
  );

  return NextResponse.json({ success: true });
}
