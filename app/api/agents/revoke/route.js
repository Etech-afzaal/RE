import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { requestId } = await req.json();
  if (!requestId) {
    return NextResponse.json(
      { error: "requestId is required." },
      { status: 400 },
    );
  }

  try {
    const requests = await query(
      "SELECT * FROM signup_requests WHERE id = ? AND status = 'approved'",
      [requestId],
    );
    const signupRequest = requests[0];
    if (!signupRequest) {
      return NextResponse.json(
        { error: "Request not found or not currently approved." },
        { status: 404 },
      );
    }

    await query("UPDATE agents SET status = 'disabled' WHERE email = ?", [
      signupRequest.email,
    ]);

    await query("UPDATE signup_requests SET status = 'revoked' WHERE id = ?", [
      requestId,
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to revoke signup request:", err);
    return NextResponse.json(
      { error: "Could not revoke this request. Please try again later." },
      { status: 500 },
    );
  }
}
