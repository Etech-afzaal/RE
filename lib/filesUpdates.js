import { query } from "@/lib/db";
import { FILES_UPDATE_STATUS } from "@/lib/filesUpdateStatus";

const SELECT_COLS =
  "id, agent_id, title, content, status, created_at, updated_at";

/**
 * Get the agent's single files update record (any status) for the dashboard.
 * Returns null if the agent has never created one.
 */
export async function getFilesUpdateForAgent(agentId) {
  const rows = await query(
    `SELECT ${SELECT_COLS}
     FROM agent_files_updates
     WHERE agent_id = ?
     LIMIT 1`,
    [agentId],
  );
  return rows[0] || null;
}

/**
 * Get the agent's published files update for the public website.
 * Returns null if the agent has no published update (drafts are hidden).
 */
export async function getPublishedFilesUpdateByAgent(agentId) {
  const rows = await query(
    `SELECT ${SELECT_COLS}
     FROM agent_files_updates
     WHERE agent_id = ? AND status = ?
     LIMIT 1`,
    [agentId, FILES_UPDATE_STATUS.PUBLISHED],
  );
  return rows[0] || null;
}

/**
 * Create or update the agent's single files update record (upsert).
 * Because of the UNIQUE(agent_id) constraint, only one row per agent exists.
 */
export async function upsertFilesUpdate(agentId, data) {
  const existing = await getFilesUpdateForAgent(agentId);

  if (existing) {
    await query(
      `UPDATE agent_files_updates
       SET title = ?, content = ?, status = ?
       WHERE id = ? AND agent_id = ?`,
      [
        data.title,
        data.content || null,
        data.status || FILES_UPDATE_STATUS.DRAFT,
        existing.id,
        agentId,
      ],
    );
    return { id: existing.id, created: false };
  }

  const result = await query(
    `INSERT INTO agent_files_updates (agent_id, title, content, status)
     VALUES (?, ?, ?, ?)`,
    [
      agentId,
      data.title,
      data.content || null,
      data.status || FILES_UPDATE_STATUS.DRAFT,
    ],
  );
  return { id: result.insertId, created: true };
}

/**
 * Delete the agent's files update record entirely.
 */
export async function deleteFilesUpdate(agentId) {
  const existing = await getFilesUpdateForAgent(agentId);
  if (!existing) {
    return { ok: false, status: 404, error: "Files update not found." };
  }
  await query("DELETE FROM agent_files_updates WHERE agent_id = ?", [agentId]);
  return { ok: true };
}
