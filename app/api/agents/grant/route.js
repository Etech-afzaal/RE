import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { query } from "@/lib/db";

export async function POST(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { requestId } = await req.json();
  if (!requestId) {
    return NextResponse.json(
      { error: "requestId is required." },
      { status: 400 },
    );
  }

  try {
    const requests = await query(
      "SELECT * FROM signup_requests WHERE id = ? AND status = 'revoked'",
      [requestId],
    );
    const signupRequest = requests[0];
    if (!signupRequest) {
      return NextResponse.json(
        { error: "Request not found or not currently revoked." },
        { status: 404 },
      );
    }

    await query("UPDATE users SET status = 'approved' WHERE email = ? AND user_type = 'agent'", [
      signupRequest.email,
    ]);

    await query("UPDATE signup_requests SET status = 'approved' WHERE id = ?", [
      requestId,
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to grant signup request:", err);
    return NextResponse.json(
      { error: "Could not grant this request. Please try again later." },
      { status: 500 },
    );
  }
}
