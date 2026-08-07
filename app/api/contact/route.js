import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mail";
import { query } from "@/lib/db";
import { AGENT_LIVE_STATUS } from "@/lib/status";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value) {
  const text = String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();

  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAdminMailHtml(payload) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dhalahore.com";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a;">
      <h2 style="margin-bottom: 12px;">New Contact Form Submission</h2>
      <p style="margin: 6px 0;"><strong>Full Name:</strong> ${escapeHtml(payload.full_name)}</p>
      <p style="margin: 6px 0;"><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
      <p style="margin: 6px 0;"><strong>Phone:</strong> ${escapeHtml(payload.phone || "N/A")}</p>
      <p style="margin: 6px 0;"><strong>Subject:</strong> ${escapeHtml(payload.subject)}</p>
      <p style="margin: 12px 0 8px;"><strong>Message:</strong></p>
      <div style="padding: 12px; background: #f7f7f7; border-radius: 8px;">${escapeHtml(payload.message)}</div>
      <p style="margin-top: 16px;">Submitted from: Dhalahore Customer Home Page</p>
      <p style="margin-top: 8px;"><a href="${siteUrl}">${siteUrl}</a></p>
    </div>
  `;
}

export async function POST(req) {
  let body;

  try {
    body = await req.json();
  } catch {
    console.error("Contact request parsing failed.");
    return NextResponse.json(
      { error: "Unable to send your message. Please try again." },
      { status: 400 },
    );
  }

  console.log("Contact request received");

  const estate_name = normalizeText(body?.estate_name);
  const full_name = normalizeText(body?.full_name || body?.name);
  const email = normalizeText(body?.email).toLowerCase();
  const phone = normalizeText(body?.phone);
  const subject = normalizeText(body?.subject);
  const message = normalizeText(body?.message);

  if (
    !full_name ||
    !email ||
    !subject ||
    !message ||
    !EMAIL_REGEX.test(email) ||
    message.length > 2000 ||
    subject.length > 150 ||
    full_name.length > 150
  ) {
    return NextResponse.json(
      { error: "Unable to send your message. Please try again." },
      { status: 400 },
    );
  }

  try {
    if (estate_name) {
      const agents = await query(
        "SELECT full_name, email, phone FROM users WHERE estate_name = ? AND status = ? AND user_type = 'agent'",
        [estate_name, AGENT_LIVE_STATUS],
      );
      const agent = agents[0];

      if (!agent) {
        return NextResponse.json(
          { error: "Agent not found for this estate." },
          { status: 404 },
        );
      }

      const html = `
        <h2>New contact request for ${escapeHtml(agent.full_name)}</h2>
        <p><strong>From:</strong> ${escapeHtml(full_name)} (${escapeHtml(email)})</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone || "N/A")}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message)}</p>
        <p>
          Estate page: <a href="${process.env.NEXT_PUBLIC_SITE_URL}/re/${estate_name}">${process.env.NEXT_PUBLIC_SITE_URL}/re/${estate_name}</a>
        </p>
      `;

      console.log("Attempting to send email to agent...", agent.email);
      await sendMail(agent.email, `New inquiry for ${agent.full_name}`, html);
      console.log("Email sent successfully to agent.");
      return NextResponse.json({ success: true });
    }

    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
    if (!adminEmail) {
      throw new Error("ADMIN_EMAIL is not configured.");
    }

    const html = buildAdminMailHtml({
      full_name,
      email,
      phone,
      subject,
      message,
    });

    console.log("Attempting to send email to admin...", adminEmail);
    await sendMail(
      adminEmail,
      `New Contact Form Submission - ${subject}`,
      html,
    );
    console.log("Email sent successfully to admin.");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SMTP Error:", err);
    return NextResponse.json(
      { error: "Unable to send your message. Please try again." },
      { status: 500 },
    );
  }
}
