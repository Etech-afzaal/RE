import { NextResponse } from "next/server";
import { getMarketingLinkByCode } from "@/lib/marketingLinks";
import { recordLinkInsight } from "@/lib/marketingInsights";
import { PROPERTY_PUBLIC_STATUS } from "@/lib/status";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "phone_click",
  "whatsapp_click",
  "email_sent",
]);

export async function POST(req) {
  let body;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ref = String(body?.ref || "").trim();
  const eventType = String(body?.event_type || "").trim();

  if (!ref) {
    return NextResponse.json({ error: "Missing ref." }, { status: 400 });
  }

  if (!ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "Invalid event type." }, { status: 400 });
  }

  const link = await getMarketingLinkByCode(ref);
  if (!link) {
    return NextResponse.json({ error: "Invalid referral link." }, { status: 404 });
  }

  if (link.property_status !== PROPERTY_PUBLIC_STATUS) {
    return NextResponse.json({ error: "Property not available." }, { status: 404 });
  }

  if (!link.subagent_is_active) {
    return NextResponse.json({ error: "Referral link inactive." }, { status: 404 });
  }

  const propertyId = body?.property_id != null ? Number(body.property_id) : null;
  if (propertyId != null && Number(link.property_id) !== propertyId) {
    return NextResponse.json({ error: "Invalid property for referral." }, { status: 400 });
  }

  await recordLinkInsight(link.id, eventType, body?.metadata || null);

  return NextResponse.json({ success: true });
}
