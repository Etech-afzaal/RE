import { customAlphabet } from "nanoid";
import { query } from "@/lib/db";
import { listSubagentsForAgent } from "@/lib/subagents";
import { getPropertyUrl } from "@/lib/propertySlug";
import { PROPERTY_PUBLIC_STATUS } from "@/lib/status";

const generateCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export const INSIGHT_EVENT_TYPES = [
  "page_view",
  "phone_click",
  "whatsapp_click",
  "email_sent",
];

function normalizeRefCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function isAgentOwnMarketingLink(link) {
  return link != null && link.subagent_id == null;
}

export async function generateUniqueMarketingCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCode();
    const rows = await query(
      "SELECT id FROM property_marketing_links WHERE unique_code = ? LIMIT 1",
      [code],
    );
    if (!rows[0]) return code;
  }
  throw new Error("Could not generate unique marketing code.");
}

export async function getMarketingLinkByCode(code) {
  const uniqueCode = normalizeRefCode(code);
  if (!uniqueCode) return null;

  const rows = await query(
    `SELECT
       ml.id,
       ml.property_id,
       ml.agent_id,
       ml.subagent_id,
       ml.unique_code,
       s.name AS subagent_name,
       s.image AS subagent_image,
       s.phone AS subagent_phone,
       s.secondary_phone AS subagent_secondary_phone,
       s.whatsapp_number AS subagent_whatsapp_number,
       s.email AS subagent_email,
       s.description AS subagent_description,
       s.is_active AS subagent_is_active,
       p.status AS property_status,
       p.title AS property_title,
       a.username AS agent_username,
       a.estate_name AS agent_estate_name,
       a.full_name AS agent_full_name,
       a.profile_image AS agent_profile_image
     FROM property_marketing_links ml
     LEFT JOIN subagents s ON s.id = ml.subagent_id
     INNER JOIN properties p ON p.id = ml.property_id
     INNER JOIN users a ON a.id = ml.agent_id
     WHERE ml.unique_code = ?
     LIMIT 1`,
    [uniqueCode],
  );

  return rows[0] || null;
}

/**
 * Resolve a marketing link for a property page if ref is valid for this property.
 * Agent-owned links are tracked but do not swap contact to a subagent.
 */
export async function resolvePropertyMarketingRef(propertyId, refCode) {
  const link = await getMarketingLinkByCode(refCode);
  if (!link) return null;
  if (Number(link.property_id) !== Number(propertyId)) return null;
  if (link.property_status !== PROPERTY_PUBLIC_STATUS) return null;
  if (isAgentOwnMarketingLink(link)) return null;
  if (!link.subagent_is_active) return null;

  return link;
}

export async function ensureAgentMarketingLink(agentId, propertyId) {
  const existing = await query(
    `SELECT id, unique_code FROM property_marketing_links
     WHERE property_id = ? AND subagent_id IS NULL
     LIMIT 1`,
    [propertyId],
  );

  if (existing[0]) {
    return existing[0];
  }

  const uniqueCode = await generateUniqueMarketingCode();
  const result = await query(
    `INSERT INTO property_marketing_links (property_id, agent_id, subagent_id, unique_code)
     VALUES (?, ?, NULL, ?)`,
    [propertyId, agentId, uniqueCode],
  );

  return { id: result.insertId, unique_code: uniqueCode };
}

export async function ensureMarketingLink(agentId, propertyId, subagentId) {
  const existing = await query(
    `SELECT id, unique_code FROM property_marketing_links
     WHERE property_id = ? AND subagent_id = ?
     LIMIT 1`,
    [propertyId, subagentId],
  );

  if (existing[0]) {
    return existing[0];
  }

  const uniqueCode = await generateUniqueMarketingCode();
  const result = await query(
    `INSERT INTO property_marketing_links (property_id, agent_id, subagent_id, unique_code)
     VALUES (?, ?, ?, ?)`,
    [propertyId, agentId, subagentId, uniqueCode],
  );

  return { id: result.insertId, unique_code: uniqueCode };
}

export async function listMarketingLinksForProperty(agentId, propertyId, agentUsername) {
  const propertyRows = await query(
    "SELECT id, title FROM properties WHERE id = ? AND agent_id = ? LIMIT 1",
    [propertyId, agentId],
  );
  const property = propertyRows[0];
  if (!property) return [];

  const agentRows = await query(
    `SELECT username, estate_name, full_name, profile_image
     FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1`,
    [agentId],
  );
  const agent = agentRows[0] || {};
  const resolvedUsername =
    agentUsername || agent.username || agent.estate_name || "";

  const propertyPath = getPropertyUrl(
    { ...property, username: resolvedUsername },
    resolvedUsername,
  );

  const links = [];

  const agentLinkRow = await ensureAgentMarketingLink(agentId, propertyId);
  links.push({
    id: agentLinkRow.id,
    unique_code: agentLinkRow.unique_code,
    url: propertyPath,
    is_agent_own: true,
    subagent: {
      id: null,
      name: agent.full_name || resolvedUsername || "Your site",
      image: agent.profile_image || null,
      phone: null,
      secondary_phone: null,
      whatsapp_number: null,
      email: null,
      is_active: true,
    },
  });

  const subagents = await listSubagentsForAgent(agentId);
  for (const subagent of subagents) {
    const linkRow = await ensureMarketingLink(agentId, propertyId, subagent.id);
    const url = `${propertyPath}?ref=${linkRow.unique_code}`;

    links.push({
      id: linkRow.id,
      unique_code: linkRow.unique_code,
      url,
      is_agent_own: false,
      subagent: {
        id: subagent.id,
        name: subagent.name,
        image: subagent.image,
        phone: subagent.phone,
        secondary_phone: subagent.secondary_phone,
        whatsapp_number: subagent.whatsapp_number,
        email: subagent.email,
        is_active: subagent.is_active,
      },
    });
  }

  return links;
}

export async function getMarketingLinkForAgent(agentId, linkId) {
  const rows = await query(
    `SELECT
       ml.id,
       ml.property_id,
       ml.agent_id,
       ml.subagent_id,
       ml.unique_code,
       s.name AS subagent_name,
       s.image AS subagent_image,
       s.phone AS subagent_phone,
       s.secondary_phone AS subagent_secondary_phone,
       s.whatsapp_number AS subagent_whatsapp_number,
       s.email AS subagent_email,
       s.description AS subagent_description,
       s.is_active AS subagent_is_active,
       p.title AS property_title,
       a.full_name AS agent_full_name,
       a.profile_image AS agent_profile_image,
       a.username AS agent_username,
       a.estate_name AS agent_estate_name
     FROM property_marketing_links ml
     LEFT JOIN subagents s ON s.id = ml.subagent_id
     INNER JOIN properties p ON p.id = ml.property_id
     INNER JOIN users a ON a.id = ml.agent_id
     WHERE ml.id = ? AND ml.agent_id = ?
     LIMIT 1`,
    [linkId, agentId],
  );

  const row = rows[0];
  if (!row) return null;

  if (isAgentOwnMarketingLink(row)) {
    const username = row.agent_username || row.agent_estate_name || "";
    row.subagent_name = row.agent_full_name || username || "Your site";
    row.subagent_image = row.agent_profile_image;
    row.subagent_is_active = 1;
  }

  return row;
}
