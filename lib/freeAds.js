import { query } from "@/lib/db";

export function agentIdFromSession(session) {
  return Number(session?.user?.agent_id || session?.user?.id);
}

export async function getFreeAdsSettings(agentId) {
  const rows = await query(
    `SELECT free_ads_enabled
     FROM users
     WHERE id = ? AND user_type = 'agent'
     LIMIT 1`,
    [agentId],
  );
  if (!rows[0]) return null;

  const agents = await query(
    `SELECT u.id, u.full_name, u.estate_name, u.username, u.profile_image,
            u.status,
            CASE WHEN b.advertiser_agent_id IS NULL THEN FALSE ELSE TRUE END AS is_blocked
     FROM users u
     LEFT JOIN agent_free_ad_blocks b
       ON b.advertiser_agent_id = ? AND b.blocked_host_agent_id = u.id
     WHERE u.user_type = 'agent' AND u.id <> ?
     ORDER BY u.full_name ASC, u.id ASC`,
    [agentId, agentId],
  );

  return {
    freeAdsEnabled: Boolean(rows[0].free_ads_enabled),
    agents: agents.map((agent) => ({
      id: Number(agent.id),
      fullName: agent.full_name,
      handle: agent.username || agent.estate_name || null,
      profileImage: agent.profile_image || null,
      status: agent.status,
      isBlocked: Boolean(agent.is_blocked),
    })),
  };
}

export async function setFreeAdsEnabled(agentId, enabled) {
  const result = await query(
    `UPDATE users
     SET free_ads_enabled = ?
     WHERE id = ? AND user_type = 'agent'`,
    [enabled, agentId],
  );
  return result.affectedRows > 0;
}

export async function agentExists(agentId) {
  const rows = await query(
    "SELECT id FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
    [agentId],
  );
  return Boolean(rows[0]);
}

export async function blockFreeAdsOnHost(advertiserAgentId, hostAgentId) {
  await query(
    `INSERT IGNORE INTO agent_free_ad_blocks
       (advertiser_agent_id, blocked_host_agent_id)
     VALUES (?, ?)`,
    [advertiserAgentId, hostAgentId],
  );
}

export async function unblockFreeAdsOnHost(advertiserAgentId, hostAgentId) {
  await query(
    `DELETE FROM agent_free_ad_blocks
     WHERE advertiser_agent_id = ? AND blocked_host_agent_id = ?`,
    [advertiserAgentId, hostAgentId],
  );
}
