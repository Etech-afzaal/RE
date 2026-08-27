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
       p.slug AS property_slug,
       a.username AS agent_username,
       a.estate_name AS agent_estate_name
     FROM property_marketing_links ml
     INNER JOIN subagents s ON s.id = ml.subagent_id
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
 */
export async function resolvePropertyMarketingRef(propertyId, refCode) {
  const link = await getMarketingLinkByCode(refCode);
  if (!link) return null;
  if (Number(link.property_id) !== Number(propertyId)) return null;
  if (link.property_status !== PROPERTY_PUBLIC_STATUS) return null;
  if (!link.subagent_is_active) return null;

  return link;
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
  const subagents = await listSubagentsForAgent(agentId);
  const links = [];

  for (const subagent of subagents) {
    const linkRow = await ensureMarketingLink(agentId, propertyId, subagent.id);
    const propertyRows = await query(
      "SELECT id, title, slug FROM properties WHERE id = ? AND agent_id = ? LIMIT 1",
      [propertyId, agentId],
    );
    const property = propertyRows[0];
    if (!property) continue;

    const propertyPath = getPropertyUrl(
      { ...property, username: agentUsername },
      agentUsername,
    );
    const url = `${propertyPath}?ref=${linkRow.unique_code}`;

    links.push({
      id: linkRow.id,
      unique_code: linkRow.unique_code,
      url,
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
       p.title AS property_title
     FROM property_marketing_links ml
     INNER JOIN subagents s ON s.id = ml.subagent_id
     INNER JOIN properties p ON p.id = ml.property_id
     WHERE ml.id = ? AND ml.agent_id = ?
     LIMIT 1`,
    [linkId, agentId],
  );
  return rows[0] || null;
}
