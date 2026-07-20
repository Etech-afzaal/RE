import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mail";
import { query } from "@/lib/db";

export async function POST(req) {
  const body = await req.json();
  const { estate_name, name, email, phone, message } = body || {};

  if (!estate_name || !name || !email || !message) {
    return NextResponse.json(
      { error: "Please provide name, email, message, and estate name." },
      { status: 400 },
    );
  }

  const agents = await query(
    "SELECT full_name, email, phone FROM agents WHERE estate_name = ? AND status = 'active'",
    [estate_name],
  );
  const agent = agents[0];
  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found for this estate." },
      { status: 404 },
    );
  }

  const html = `
    <h2>New contact request for ${agent.full_name}</h2>
    <p><strong>From:</strong> ${name} (${email})</p>
    <p><strong>Phone:</strong> ${phone || "N/A"}</p>
    <p><strong>Message:</strong></p>
    <p>${message}</p>
    <p>
      Estate page: <a href="${process.env.NEXT_PUBLIC_SITE_URL}/re/${estate_name}">${process.env.NEXT_PUBLIC_SITE_URL}/re/${estate_name}</a>
    </p>
  `;

  try {
    await sendMail(agent.email, `New inquiry for ${agent.full_name}`, html);
  } catch (err) {
    console.error("Contact email send failure:", err);
    return NextResponse.json(
      { error: "Failed to send email. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
