import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import {
  getManagedPropertiesPageByAgent,
  getAgentPropertyStats,
} from "@/lib/queries";
import { query } from "@/lib/db";
import { normalizeLocationFields } from "@/lib/propertyLocation";
import { PROPERTY_STATUS } from "@/lib/status";
import { sanitizeSearchInput } from "@/lib/validators/common";
import { validatePropertyDraftInput } from "@/lib/validators/propertyValidator";

export async function GET(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = Number(session.user.agent_id || session.user.id);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = sanitizeSearchInput(searchParams.get("search")).value;
  const page = searchParams.get("page");
  const includeStats = searchParams.get("stats") === "1";

  const payload = await getManagedPropertiesPageByAgent(agentId, {
    page,
    pageSize: 10,
    status,
    search,
  });
  if (includeStats) {
    payload.stats = await getAgentPropertyStats(agentId);
  }
  return NextResponse.json(payload);
}

export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = Number(session.user.agent_id || session.user.id);
  const body = await req.json();
  const validated = validatePropertyDraftInput(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const {
    title,
    description,
    size_value,
    size_unit,
    price,
    price_currency,
  } = validated.data;
  const { city, area, phase, address, location } = normalizeLocationFields({
    ...body,
    ...validated.data,
  });

  // Always a draft: images are uploaded after the row exists, so a listing can
  // never satisfy the submission rules at insert time. The client submits for
  // approval via POST /api/properties/:id/submit once uploads finish.
  const status = PROPERTY_STATUS.DRAFT;
  const trimmedTitle = String(title).trim();

  const result = await query(
    `INSERT INTO properties
      (agent_id, title, description, size_value, size_unit, price, price_currency,
       location, city, area, phase, address, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agentId,
      trimmedTitle,
      description || null,
      size_value ?? null,
      size_unit || "marla",
      price ?? null,
      price_currency || "PKR",
      location,
      city,
      area,
      phase,
      address,
      status,
    ],
  );

  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.PROPERTY_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PROPERTY,
    entityId: result.insertId,
    description: `${agentName} created property "${trimmedTitle}"`,
    metadata: {
      property_title: trimmedTitle,
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      status,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({
    success: true,
    propertyId: result.insertId,
    status,
  });
}
