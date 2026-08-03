import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const rows = await query(
    `SELECT id, estate_name, username, company_name, company_logo,
            description, office_address, social_links, areas_served
     FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1`,
    [agentId],
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }
  return NextResponse.json({ branding: rows[0] });
}

export async function PATCH(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const body = await req.json().catch(() => ({}));

  const company_name = String(body.company_name || "").trim();
  const description =
    body.description != null ? String(body.description).trim() : null;
  const office_address = String(body.office_address || "").trim();
  const social_links = String(body.social_links || "").trim();
  const areas_served =
    body.areas_served != null ? String(body.areas_served).trim() : null;

  await query(
    `UPDATE users
     SET company_name = ?, description = ?, office_address = ?,
         social_links = ?, areas_served = ?
     WHERE id = ?`,
    [
      company_name || null,
      description || null,
      office_address || null,
      social_links || null,
      areas_served || null,
      agentId,
    ],
  );

  const rows = await query(
    "SELECT username, estate_name FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
    [agentId],
  );
  const handle = rows[0]?.username || rows[0]?.estate_name;
  revalidatePath("/");
  if (handle) revalidatePath(`/re/${handle}`);

  return NextResponse.json({ success: true });
}
