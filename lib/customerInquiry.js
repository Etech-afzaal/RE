import { query } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import {
  AGENT_LIVE_STATUS,
  PROPERTY_PUBLIC_STATUS,
} from "@/lib/status";
import { validateInquiryInput } from "@/lib/validators/inquiryValidator";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] || "Agent";
}

/**
 * Resolve the live agent (+ optional public property) for an inquiry.
 * Never trusts an agent email from the client.
 */
export async function resolveInquiryTarget({ agent_id, property_id }) {
  const propertyId = property_id != null ? Number(property_id) : null;
  const agentId = agent_id != null ? Number(agent_id) : null;

  if (propertyId) {
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return { error: "Invalid property.", status: 400 };
    }

    const rows = await query(
      `SELECT
         p.id AS property_id,
         p.title AS property_title,
         p.location AS property_location,
         a.id AS agent_id,
         a.full_name AS agent_name,
         a.email AS agent_email
       FROM properties p
       INNER JOIN users a ON a.id = p.agent_id
       WHERE p.id = ?
         AND p.status = ?
         AND a.status = ?
         AND a.user_type = 'agent'
       LIMIT 1`,
      [propertyId, PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
    );

    const row = rows[0];
    if (!row) {
      return { error: "Property or agent not found.", status: 404 };
    }

    return {
      agent: {
        id: row.agent_id,
        full_name: row.agent_name,
        email: row.agent_email,
      },
      property: {
        id: row.property_id,
        title: row.property_title,
        location: row.property_location,
      },
    };
  }

  if (agentId) {
    if (!Number.isInteger(agentId) || agentId <= 0) {
      return { error: "Invalid agent.", status: 400 };
    }

    const rows = await query(
      `SELECT id, full_name, email
       FROM users
       WHERE id = ?
         AND status = ?
         AND user_type = 'agent'
       LIMIT 1`,
      [agentId, AGENT_LIVE_STATUS],
    );

    const agent = rows[0];
    if (!agent) {
      return { error: "Agent not found.", status: 404 };
    }

    return {
      agent: {
        id: agent.id,
        full_name: agent.full_name,
        email: agent.email,
      },
      property: null,
    };
  }

  return {
    error: "Provide either agent_id or property_id.",
    status: 400,
  };
}

function buildAgentInquiryHtml({ agent, customer, property }) {
  const greeting = firstName(agent.full_name);
  const propertyIntro = property
    ? `
      <p style="margin: 0 0 6px;"><strong>New Inquiry For:</strong></p>
      <p style="margin: 0;">${escapeHtml(property.title)}</p>
      <p style="margin: 0 0 16px;">${escapeHtml(property.location || "N/A")}</p>
    `
    : "";
  const propertyBlock = property
    ? `
      <p style="margin: 18px 0 6px;"><strong>Property:</strong></p>
      <p style="margin: 0;">${escapeHtml(property.title)}</p>
      <p style="margin: 12px 0 6px;"><strong>Location:</strong></p>
      <p style="margin: 0;">${escapeHtml(property.location || "N/A")}</p>
    `
    : "";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a;">
      ${propertyIntro}
      <p>Hello ${escapeHtml(greeting)},</p>
      <p>You received a new customer inquiry.</p>

      <p style="margin: 18px 0 8px;"><strong>Customer Details:</strong></p>
      <p style="margin: 4px 0;"><strong>Name:</strong><br/>${escapeHtml(customer.name)}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong><br/>${escapeHtml(customer.email)}</p>
      <p style="margin: 4px 0;"><strong>Phone:</strong><br/>${escapeHtml(customer.phone || "N/A")}</p>

      ${customer.subject ? `<p style="margin: 18px 0 6px;"><strong>Subject:</strong><br/>${escapeHtml(customer.subject)}</p>` : ""}

      <p style="margin: 18px 0 8px;"><strong>Message:</strong></p>
      <div style="padding: 12px; background: #f7f7f7; border-radius: 8px;">${escapeHtml(customer.message)}</div>

      ${propertyBlock}

      <p style="margin-top: 20px;">Please contact the customer directly.</p>
      <p style="margin-top: 8px;"><strong>DhaLahore</strong></p>
    </div>
  `;
}

function buildInquirySubject(property) {
  if (property?.title) {
    return `New Inquiry For: ${property.title}`;
  }
  return "New Inquiry From DhaLahore Customer";
}

async function getSuperadminEmail() {
  const rows = await query(
    "SELECT email FROM users WHERE user_type = 'superadmin' ORDER BY id ASC LIMIT 1",
  );
  const email = String(rows[0]?.email || "").trim();
  return email || null;
}

/**
 * Create a customer inquiry, persist it, and email the owning agent.
 *
 * @param {{ agent_id?: number, property_id?: number, name: string, email: string, phone?: string, subject?: string, message: string, page_url?: string }} input
 */
export async function createCustomerInquiry(input) {
  const validated = validateInquiryInput(input, {
    requireSubject: Boolean(input?.agent_id && !input?.property_id),
  });
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      error: validated.error || "Unable to send your message. Please try again.",
    };
  }

  const { name, email, phone, subject, message, page_url } = validated.data;

  const resolved = await resolveInquiryTarget({
    agent_id: input?.agent_id,
    property_id: input?.property_id,
  });

  if (resolved.error) {
    return {
      ok: false,
      status: resolved.status,
      error: resolved.error,
    };
  }

  const { agent, property } = resolved;

  const insert = await query(
    `INSERT INTO customer_inquiries
      (agent_id, property_id, customer_name, customer_email, customer_phone, message, page_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      agent.id,
      property?.id ?? null,
      name,
      email,
      phone || null,
      subject ? `Subject: ${subject}\n\n${message}` : message,
      page_url || null,
    ],
  );

  const customer = { name, email, phone, subject, message };
  const html = buildAgentInquiryHtml({ agent, customer, property });
  const emailSubject = buildInquirySubject(property);
  const adminEmail = await getSuperadminEmail();
  const agentEmail = String(agent.email || "").trim();
  const cc =
    adminEmail && adminEmail.toLowerCase() !== agentEmail.toLowerCase()
      ? adminEmail
      : null;

  try {
    await sendMail(agent.email, emailSubject, html, cc ? { cc } : undefined);
  } catch (err) {
    console.error("Customer inquiry email failed:", err);
    // Roll back so a failed send does not leave an inquiry the agent never sees.
    await query("DELETE FROM customer_inquiries WHERE id = ?", [
      insert.insertId,
    ]).catch(() => {});
    return {
      ok: false,
      status: 500,
      error: "Unable to send your message. Please try again.",
    };
  }

  return {
    ok: true,
    inquiryId: insert.insertId,
    agentId: agent.id,
    propertyId: property?.id ?? null,
  };
}
