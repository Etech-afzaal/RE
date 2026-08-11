import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";
import { generateTempPassword } from "@/lib/generate";
import { sendMail, agentCredentialsEmail } from "@/lib/mail";

export async function POST(req) {
  const { session, error } = await requireAdmin();
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
      "SELECT id FROM users WHERE estate_name = ? AND user_type = 'agent'",
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

    const insertResult = await query(
      `INSERT INTO users (estate_name, username, full_name, email, phone, password_hash, must_reset_password, status, user_type)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, 'approved', 'agent')`,
      [
        estateName,
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

    let emailSent = true;
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
      emailSent = false;
      console.error("Failed to send agent credentials email:", err);
    }

    const adminName = session?.user?.name || "Superadmin";
    await createAuditLog({
      userId: Number(session?.user?.id) || null,
      action: AUDIT_ACTIONS.AGENT_APPROVED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: insertResult.insertId,
      description: `Approved agent ${signupRequest.full_name}`,
      metadata: {
        actor_name: adminName,
        agent_name: signupRequest.full_name,
        agent_username: estateName,
        estate_name: estateName,
        signup_request_id: Number(requestId),
        email: signupRequest.email,
        credentials_email_sent: emailSent,
      },
      ipAddress: getRequestIp(req),
    });

    return NextResponse.json({
      success: true,
      estate_name: estateName,
      emailSent,
      warning: emailSent
        ? undefined
        : "Agent account was created, but the credentials email could not be sent. Share the temporary password manually or resend from your mail system.",
      // Only returned when email failed so an admin can still onboard the agent.
      tempPassword: emailSent ? undefined : tempPassword,
    });
  } catch (err) {
    console.error("Failed to approve signup request:", err);
    return NextResponse.json(
      { error: "Could not approve this request. Please try again later." },
      { status: 500 },
    );
  }
}
