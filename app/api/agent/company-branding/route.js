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
import { validateCompanyBrandingInput } from "@/lib/validators/userValidator";

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
  const validated = validateCompanyBrandingInput(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const {
    company_name,
    description,
    office_address,
    social_links,
    areas_served,
  } = validated.data;

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
    "SELECT username, estate_name, full_name FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
    [agentId],
  );
  const handle = rows[0]?.username || rows[0]?.estate_name;
  revalidatePath("/");
  if (handle) revalidatePath(`/re/${handle}`);

  const agentName = rows[0]?.full_name || session.user.name || "Agent";
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.COMPANY_BRANDING_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.BRANDING,
    entityId: agentId,
    description: `${agentName} updated company branding`,
    metadata: {
      actor_name: agentName,
      agent_name: agentName,
      agent_username: handle,
      estate_name: rows[0]?.estate_name || handle,
      company_name: company_name || null,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true });
}
