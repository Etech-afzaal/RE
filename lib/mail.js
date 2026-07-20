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
  }
});

export async function sendMail(to, subject, html) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export function newSignupRequestEmail(req) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/dashboard/requests`;
  return `
    <h2>New Agent Signup Request</h2>
    <p><strong>Name:</strong> ${req.full_name}</p>
    <p><strong>Email:</strong> ${req.email}</p>
    <p><strong>Phone:</strong> ${req.phone || "-"}</p>
    <p><a href="${dashboardUrl}">Review this request in the admin dashboard</a></p>
  `;
}

export function agentCredentialsEmail(opts) {
  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/agent/login`;
  const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/re/${opts.estate_name}`;
  return `
    <h2>Welcome to Dhalahore Properties, ${opts.full_name}</h2>
    <p>Your agent account has been approved. Here are your login details:</p>
    <p><strong>Email:</strong> ${opts.email}<br/>
       <strong>Temporary Password:</strong> ${opts.tempPassword}</p>
    <p>Please <a href="${loginUrl}">log in here</a> and change your password on first login.</p>
    <p>Your public listings page will be live at:<br/>
       <a href="${publicUrl}">${publicUrl}</a></p>
  `;
}
