import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  getAgentFinderLocationContext,
  getPublishedPropertiesPage,
  searchLiveAgentsForFinder,
} from "@/lib/queries";
import { sanitizeSearchInput } from "@/lib/validators/common";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

function parseOptionalNumber(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export async function GET(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const { searchParams } = new URL(req.url);

  // Agent dropdown suggestions for the finder filter.
  if (searchParams.get("mode") === "agents") {
    const q = sanitizeSearchInput(searchParams.get("q") || "").value;
    const agents = await searchLiveAgentsForFinder(q, 12);
    return NextResponse.json({
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.full_name || agent.company_name || agent.estate_name || "Agent",
        company: agent.company_name || agent.estate_name || "",
        username: agent.username || "",
      })),
    });
  }

  const page = searchParams.get("page") || "1";
  const city = sanitizeSearchInput(searchParams.get("city") || "").value;
  const area = sanitizeSearchInput(searchParams.get("area") || "").value;
  const block = sanitizeSearchInput(searchParams.get("block") || "").value;
  const propertyNumber = sanitizeSearchInput(searchParams.get("propertyNumber") || "").value;
  const listingType = String(searchParams.get("status") || "sale").trim().toLowerCase();
  const propertyCategory = String(searchParams.get("category") || "").trim().toLowerCase();
  const propertySubtype = String(searchParams.get("subtype") || "all").trim();
  const agentId = searchParams.get("agentId") || "";
  const minPrice = parseOptionalNumber(searchParams.get("minPrice"));
  const maxPrice = parseOptionalNumber(searchParams.get("maxPrice"));
  const minSize = parseOptionalNumber(searchParams.get("minSize"));
  const maxSize = parseOptionalNumber(searchParams.get("maxSize"));
  const sizeUnit = String(searchParams.get("sizeUnit") || "marla").trim().toLowerCase();

  const hasExplicitFilters = Boolean(
    city ||
      area ||
    block ||
    propertyNumber ||
      minSize != null ||
      maxSize != null ||
      minPrice != null ||
      maxPrice != null ||
      (propertySubtype && propertySubtype !== "all") ||
      agentId,
  );

  let nearbyTerms = [];
  let defaultCity = "";
  if (!hasExplicitFilters) {
    const location = await getAgentFinderLocationContext(
      agentIdFromSession(session),
    );
    nearbyTerms = location.terms || [];
    defaultCity = location.city || "";
  }

  const payload = await getPublishedPropertiesPage({
    page,
    pageSize: 15,
    city,
    area,
    block,
    propertyNumber,
    listingType,
    propertyCategory,
    minSize,
    maxSize,
    sizeUnit,
    minPrice,
    maxPrice,
    propertySubtype,
    agentId,
    nearbyTerms,
  });

  return NextResponse.json({ ...payload, defaultCity });
}
