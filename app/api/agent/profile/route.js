import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const rows = await query(
    `SELECT id, estate_name, username, full_name, email, phone,
            profile_image, company_logo, description, areas_served, status
     FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1`,
    [agentId],
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }
  return NextResponse.json({ agent: rows[0] });
}

export async function PATCH(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const body = await req.json().catch(() => ({}));
  const full_name = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  const description =
    body.description != null ? String(body.description).trim() : null;
  const areas_served =
    body.areas_served != null ? String(body.areas_served).trim() : null;

  if (!full_name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // Email stays identity-bound; do not allow arbitrary email changes here.
  await query(
    `UPDATE users
     SET full_name = ?, phone = ?, description = ?, areas_served = ?
     WHERE id = ?`,
    [
      full_name,
      phone || null,
      description || null,
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

  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.AGENT_PROFILE_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: agentId,
    description: `${full_name} updated their profile`,
    metadata: {
      actor_name: full_name,
      agent_name: full_name,
      agent_username: handle,
      estate_name: rows[0]?.estate_name || handle,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true });
}
