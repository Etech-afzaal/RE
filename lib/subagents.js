import { query } from "@/lib/db";

const SUBAGENT_SELECT =
  "id, agent_id, name, image, phone, secondary_phone, whatsapp_number, email, description, is_active, created_at, updated_at";

export async function countActiveSubagents(agentId) {
  const rows = await query(
    "SELECT COUNT(*) AS count FROM subagents WHERE agent_id = ? AND is_active = 1",
    [agentId],
  );
  return Number(rows[0]?.count || 0);
}

export async function listSubagentsForAgent(agentId, { includeInactive = false } = {}) {
  const activeClause = includeInactive ? "" : "AND is_active = 1";
  const rows = await query(
    `SELECT ${SUBAGENT_SELECT}
     FROM subagents
     WHERE agent_id = ? ${activeClause}
     ORDER BY created_at ASC`,
    [agentId],
  );
  return rows;
}

export async function getSubagentForAgent(agentId, subagentId) {
  const rows = await query(
    `SELECT ${SUBAGENT_SELECT}
     FROM subagents
     WHERE id = ? AND agent_id = ?
     LIMIT 1`,
    [subagentId, agentId],
  );
  return rows[0] || null;
}

export async function createSubagent(agentId, data) {
  const result = await query(
    `INSERT INTO subagents
      (agent_id, name, image, phone, secondary_phone, whatsapp_number, email, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agentId,
      data.name,
      data.image || null,
      data.phone,
      data.secondary_phone || null,
      data.whatsapp_number || null,
      data.email,
      data.description,
    ],
  );

  return { ok: true, id: result.insertId };
}

export async function updateSubagent(agentId, subagentId, data) {
  const existing = await getSubagentForAgent(agentId, subagentId);
  if (!existing) {
    return { ok: false, status: 404, error: "Subagent not found." };
  }

  await query(
    `UPDATE subagents
     SET name = ?, phone = ?, secondary_phone = ?, whatsapp_number = ?,
         email = ?, description = ?
     WHERE id = ? AND agent_id = ?`,
    [
      data.name,
      data.phone,
      data.secondary_phone || null,
      data.whatsapp_number || null,
      data.email,
      data.description,
      subagentId,
      agentId,
    ],
  );

  if (data.image !== undefined) {
    await query(
      "UPDATE subagents SET image = ? WHERE id = ? AND agent_id = ?",
      [data.image || null, subagentId, agentId],
    );
  }

  return { ok: true };
}

/** Soft-delete: archive subagent but keep historical data. */
export async function archiveSubagent(agentId, subagentId) {
  const existing = await getSubagentForAgent(agentId, subagentId);
  if (!existing) {
    return { ok: false, status: 404, error: "Subagent not found." };
  }

  if (!existing.is_active) {
    return { ok: true };
  }

  await query(
    "UPDATE subagents SET is_active = 0 WHERE id = ? AND agent_id = ?",
    [subagentId, agentId],
  );

  return { ok: true };
}
