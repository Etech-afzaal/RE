import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { getMarketingLinkForAgent, isAgentOwnMarketingLink } from "@/lib/marketingLinks";
import { getLinkInsightCounts } from "@/lib/marketingInsights";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const linkId = Number(params.linkId);

  if (!Number.isInteger(linkId) || linkId <= 0) {
    return NextResponse.json({ error: "Invalid link." }, { status: 400 });
  }

  const link = await getMarketingLinkForAgent(agentId, linkId);
  if (!link) {
    return NextResponse.json({ error: "Marketing link not found." }, { status: 404 });
  }

  const counts = await getLinkInsightCounts(linkId);

  return NextResponse.json({
    link: {
      id: link.id,
      unique_code: link.unique_code,
      property_id: link.property_id,
      property_title: link.property_title,
      is_agent_own: isAgentOwnMarketingLink(link),
      subagent: {
        id: link.subagent_id,
        name: link.subagent_name,
        image: link.subagent_image,
        phone: link.subagent_phone,
        secondary_phone: link.subagent_secondary_phone,
        whatsapp_number: link.subagent_whatsapp_number,
        email: link.subagent_email,
        description: link.subagent_description,
        is_active: link.subagent_is_active,
      },
    },
    insights: {
      page_view: counts.page_view,
      phone_click: counts.phone_click,
      whatsapp_click: counts.whatsapp_click,
      email_sent: counts.email_sent,
    },
  });
}
