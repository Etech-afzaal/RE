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
import { normalizeMarketingSections } from "@/lib/propertyMarketingSections";

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
  try {
    const { session, error } = await requireAgent();
    if (error) return error;

    const agentId = Number(session.user.agent_id || session.user.id);
    const body = await req.json();
    const validated = validatePropertyDraftInput(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const marketing = normalizeMarketingSections(body);
    if (!marketing.ok) {
      return NextResponse.json({ error: marketing.error }, { status: 400 });
    }
    const {
      property_highlights,
      why_this_home,
      location_advantages,
      investment_insights,
    } = marketing.data;

    const {
      title,
      description,
      size_value,
      size_unit,
      price,
      price_currency,
      property_type,
      property_subtype,
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
    const nextType =
      property_type || validated.data.propertyType || null;
    const nextSubtype =
      property_subtype || validated.data.propertySubtype || null;

    const result = await query(
      `INSERT INTO properties
      (agent_id, title, property_type, property_subtype, description, size_value, size_unit, price, price_currency,
       location, city, area, phase, address, status,
       property_highlights, why_this_home, location_advantages, investment_insights)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
      agentId,
      trimmedTitle,
      nextType,
      nextSubtype,
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
      property_highlights ? JSON.stringify(property_highlights) : null,
      why_this_home ? JSON.stringify(why_this_home) : null,
      location_advantages ? JSON.stringify(location_advantages) : null,
      investment_insights ? JSON.stringify(investment_insights) : null,
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
  } catch (err) {
    // The database driver can include SQL and connection details. Keep those
    // server-side and return only an actionable, non-sensitive message.
    console.error("Could not create property", err);
    if (err?.code === "ER_BAD_FIELD_ERROR") {
      return NextResponse.json(
        {
          error:
            "Property creation is temporarily unavailable because the property marketing fields have not been set up. Please contact support.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        error:
          "Property creation could not be completed due to a server error. Please try again shortly.",
      },
      { status: 500 },
    );
  }
}
