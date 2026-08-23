import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mail";
import { query } from "@/lib/db";
import { AGENT_LIVE_STATUS } from "@/lib/status";
import {
  normalizeInquiryPageUrl,
  validateContactInput,
} from "@/lib/validators/inquiryValidator";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function resolveAdminInquiryAgentId() {
  const rows = await query(
    "SELECT id FROM users WHERE user_type = 'superadmin' ORDER BY id ASC LIMIT 1",
  );
  return rows[0]?.id ?? null;
}

async function saveContactInquiry({
  agentId,
  name,
  email,
  phone,
  subject,
  message,
  pageUrl,
}) {
  const storedMessage = subject
    ? `Subject: ${subject}\n\n${message}`
    : message;
  const insert = await query(
    `INSERT INTO customer_inquiries
      (agent_id, property_id, customer_name, customer_email, customer_phone, message, page_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      agentId,
      null,
      name,
      email,
      phone || null,
      storedMessage,
      normalizeInquiryPageUrl(pageUrl) || "/",
    ],
  );
  return insert.insertId;
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

  const validated = validateContactInput(body);
  if (!validated.ok) {
    return NextResponse.json(
      {
        error:
          validated.error || "Unable to send your message. Please try again.",
      },
      { status: 400 },
    );
  }

  const { estate_name, full_name, email, phone, subject, message } =
    validated.data;
  const pageUrl = body?.page_url;

  try {
    if (estate_name) {
      const agents = await query(
        "SELECT id, full_name, email, phone FROM users WHERE estate_name = ? AND status = ? AND user_type = 'agent'",
        [estate_name, AGENT_LIVE_STATUS],
      );
      const agent = agents[0];

      if (!agent) {
        return NextResponse.json(
          { error: "Agent not found for this estate." },
          { status: 404 },
        );
      }

      const inquiryId = await saveContactInquiry({
        agentId: agent.id,
        name: full_name,
        email,
        phone,
        subject,
        message,
        pageUrl: pageUrl || `/re/${estate_name}`,
      });

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

      try {
        await sendMail(agent.email, `New inquiry for ${agent.full_name}`, html);
      } catch (err) {
        await query("DELETE FROM customer_inquiries WHERE id = ?", [
          inquiryId,
        ]).catch(() => {});
        throw err;
      }
      return NextResponse.json({ success: true });
    }

    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
    if (!adminEmail) {
      throw new Error("ADMIN_EMAIL is not configured.");
    }

    const adminAgentId = await resolveAdminInquiryAgentId();
    if (!adminAgentId) {
      throw new Error("No admin account available to store the inquiry.");
    }

    const inquiryId = await saveContactInquiry({
      agentId: adminAgentId,
      name: full_name,
      email,
      phone,
      subject,
      message,
      pageUrl: pageUrl || "/",
    });

    const html = buildAdminMailHtml({
      full_name,
      email,
      phone,
      subject,
      message,
    });

    try {
      await sendMail(
        adminEmail,
        `New Contact Form Submission - ${subject}`,
        html,
      );
    } catch (err) {
      await query("DELETE FROM customer_inquiries WHERE id = ?", [
        inquiryId,
      ]).catch(() => {});
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SMTP Error:", err);
    return NextResponse.json(
      { error: "Unable to send your message. Please try again." },
      { status: 500 },
    );
  }
}
