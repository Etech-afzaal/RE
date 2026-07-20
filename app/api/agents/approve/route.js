import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { generateTempPassword } from "@/lib/generate";
import { sendMail, agentCredentialsEmail } from "@/lib/mail";

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
      "SELECT * FROM signup_requests WHERE id = ? AND status = 'pending'",
      [requestId],
    );
    const signupRequest = requests[0];
    if (!signupRequest) {
      return NextResponse.json(
        { error: "Request not found or already handled." },
        { status: 404 },
      );
    }

    const estateName = signupRequest.estate_name;
    const existingEstate = await query(
      "SELECT id FROM agents WHERE estate_name = ?",
      [estateName],
    );
    if (existingEstate.length > 0) {
      return NextResponse.json(
        { error: "An estate with that name already exists." },
        { status: 409 },
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await query(
      `INSERT INTO agents (estate_name, full_name, email, phone, password_hash, must_reset_password)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [
        estateName,
        signupRequest.full_name,
        signupRequest.email,
        signupRequest.phone,
        passwordHash,
      ],
    );

    await query("UPDATE signup_requests SET status = 'approved' WHERE id = ?", [
      requestId,
    ]);

    try {
      await sendMail(
        signupRequest.email,
        "Your Dhalahore Properties agent account is ready",
        agentCredentialsEmail({
          full_name: signupRequest.full_name,
          email: signupRequest.email,
          tempPassword,
          estate_name: estateName,
        }),
      );
    } catch (err) {
      console.error("Failed to send agent credentials email:", err);
    }

    return NextResponse.json({
      success: true,
      estate_name: estateName,
    });
  } catch (err) {
    console.error("Failed to approve signup request:", err);
    return NextResponse.json(
      { error: "Could not approve this request. Please try again later." },
      { status: 500 },
    );
  }
}
