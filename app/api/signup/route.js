import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";
import { sendMail, newSignupRequestEmail } from "@/lib/mail";
import { validateSignupInput } from "@/lib/validators/userValidator";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const parsed = validateSignupInput(body);

  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error || "Please fill in all required fields correctly." },
      { status: 400 },
    );
  }

  const { full_name, estate_name, email, phone, message } = parsed.data;
  const normalizedEstateName = String(estate_name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedEstateName) {
    return NextResponse.json(
      { error: "Please enter a valid company / estate name." },
      { status: 400 },
    );
  }

  const normalizeEstateValue = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  // Prevent duplicate pending requests / already-registered agents
  const existingAgent = await query("SELECT id FROM users WHERE email = ?", [
    email,
  ]);
  if (existingAgent.length > 0) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const existingAgents = await query(
    "SELECT estate_name, username, company_name FROM users WHERE user_type = 'agent'",
  );
  const existingSignupRequests = await query(
    "SELECT estate_name FROM signup_requests",
  );

  const takenEstateNames = new Set(
    [
      ...existingAgents.map((row) => normalizeEstateValue(row.estate_name)),
      ...existingAgents.map((row) => normalizeEstateValue(row.company_name)),
      ...existingSignupRequests.map((row) =>
        normalizeEstateValue(row.estate_name),
      ),
    ].filter(Boolean),
  );
  const takenUsernames = new Set(
    existingAgents
      .map((row) => normalizeEstateValue(row.username))
      .filter(Boolean),
  );

  if (takenEstateNames.has(normalizedEstateName)) {
    return NextResponse.json(
      { error: "Estate name already exists. Please choose a different estate name." },
      { status: 409 },
    );
  }
  if (takenUsernames.has(normalizedEstateName)) {
    return NextResponse.json(
      { error: "Username already exists. Please choose a different user name." },
      { status: 409 },
    );
  }

  try {
    const insertResult = await query(
      "INSERT INTO signup_requests (full_name, estate_name, email, phone, message) VALUES (?, ?, ?, ?, ?)",
      [full_name, normalizedEstateName, email, phone || null, message || null],
    );
    revalidatePath("/admin/dashboard/requests");

    await createAuditLog({
      userId: null,
      action: AUDIT_ACTIONS.AGENT_SIGNUP_REQUESTED,
      entityType: AUDIT_ENTITY_TYPES.SIGNUP_REQUEST,
      entityId: insertResult.insertId,
      description: `Agent signup request submitted by ${full_name}`,
      metadata: {
        actor_name: full_name,
        agent_name: full_name,
        estate_name: normalizedEstateName,
        email,
        phone: phone || null,
      },
      ipAddress: getRequestIp(req),
    });
  } catch (err) {
    console.error("Failed to save signup request:", err);
    return NextResponse.json(
      { error: "Could not save your request. Please try again later." },
      { status: 500 },
    );
  }

  try {
    const admins = await query(
      "SELECT email FROM users WHERE user_type = 'superadmin' LIMIT 1",
    );
    await sendMail(
      admins[0]?.email,
      `New agent signup request: ${full_name}`,
      newSignupRequestEmail({ full_name, email, phone }),
    );
  } catch (err) {
    // Don't fail the request just because the notification email failed —
    // the request is still saved and visible in the admin dashboard.
    console.error("Failed to send admin notification email:", err);
  }

  return NextResponse.json({ success: true });
}
