import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export async function sendMail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });

    return info;
  } catch (error) {
    console.error("SMTP Error:", error);
    throw error;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function newSignupRequestEmail(req) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/dashboard/requests`;
  return `
    <h2>New Agent Signup Request</h2>
    <p><strong>Name:</strong> ${escapeHtml(req.full_name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(req.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(req.phone || "-")}</p>
    <p><strong>Licence number:</strong> ${escapeHtml(req.licence_number || "-")}</p>
    <p><a href="${dashboardUrl}">Review this request in the admin dashboard</a></p>
  `;
}

export function agentCredentialsEmail(opts) {
  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/agent/login`;
  const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/re/${encodeURIComponent(opts.estate_name)}`;
  return `
    <h2>Welcome to Dhalahore Properties, ${escapeHtml(opts.full_name)}</h2>
    <p>Your agent account has been approved. Here are your login details:</p>
    <p><strong>Email:</strong> ${escapeHtml(opts.email)}<br/>
       <strong>Temporary Password:</strong> ${escapeHtml(opts.tempPassword)}</p>
    <p>Please <a href="${loginUrl}">log in here</a> and change your password on first login.</p>
    <p>Your public listings page will be live at:<br/>
       <a href="${publicUrl}">${publicUrl}</a></p>
  `;
}
