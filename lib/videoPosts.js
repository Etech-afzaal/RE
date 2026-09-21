import { query } from "@/lib/db";
import { VIDEO_POST_STATUS } from "@/lib/videoPostStatus";

const VIDEO_POST_SELECT =
  "id, agent_id, title, slug, description, video_url, thumbnail_url, status, created_at, updated_at";

const VIDEO_POST_PUBLIC_SELECT =
  "id, agent_id, title, slug, description, video_url, thumbnail_url, status, created_at, updated_at";

/**
 * One page of an agent's own video posts (any status) for the dashboard.
 * Mirrors lib/blogs.js#getBlogsPageByAgent.
 */
export async function getVideoPostsPageByAgent(
  agentId,
  { page = 1, pageSize = 10, status, search } = {},
) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.max(
    1,
    Math.min(100, Number.parseInt(pageSize, 10) || 10),
  );

  const filters = ["agent_id = ?"];
  const params = [agentId];

  if (status && status !== "all") {
    filters.push("status = ?");
    params.push(status);
  }

  const normalizedSearch = String(search || "").trim();
  if (normalizedSearch) {
    const like = `%${normalizedSearch}%`;
    filters.push("(title LIKE ? OR description LIKE ?)");
    params.push(like, like);
  }

  const where = filters.join(" AND ");
  const countRows = await query(
    `SELECT COUNT(*) AS total FROM video_posts WHERE ${where}`,
    params,
  );
  const totalVideoPosts = Number(countRows[0]?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(totalVideoPosts / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const offset = (currentPage - 1) * safePageSize;

  const videoPosts = await query(
    `SELECT ${VIDEO_POST_SELECT}
     FROM video_posts
     WHERE ${where}
     ORDER BY updated_at DESC, created_at DESC
     LIMIT ${safePageSize} OFFSET ${offset}`,
    params,
  );

  return {
    videoPosts,
    currentPage,
    totalVideoPosts,
    totalPages,
  };
}

/**
 * Single video post owned by an agent (any status). Used by the dashboard edit
 * page and the agent-facing GET API.
 */
export async function getVideoPostForAgent(agentId, videoPostId) {
  const rows = await query(
    `SELECT ${VIDEO_POST_SELECT}
     FROM video_posts
     WHERE id = ? AND agent_id = ?
     LIMIT 1`,
    [videoPostId, agentId],
  );
  return rows[0] || null;
}

/**
 * Published video posts for an agent's public website, newest first.
 * Never returns draft videos.
 */
export async function getPublishedVideoPostsByAgent(agentId, { limit } = {}) {
  const safeLimit =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.min(50, Math.max(1, Number(limit)))
      : 50;

  return query(
    `SELECT ${VIDEO_POST_PUBLIC_SELECT}
     FROM video_posts
     WHERE agent_id = ? AND status = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ${safeLimit}`,
    [agentId, VIDEO_POST_STATUS.PUBLISHED],
  );
}

/**
 * Public video post lookup by agent id + slug. Only published videos are
 * returned so draft URLs never resolve on the public site.
 */
export async function getPublishedVideoPostByAgentAndSlug(agentId, slug) {
  const normalized = String(slug || "").trim();
  if (!normalized) return null;

  const rows = await query(
    `SELECT ${VIDEO_POST_PUBLIC_SELECT}
     FROM video_posts
     WHERE agent_id = ? AND slug = ? AND status = ?
     LIMIT 1`,
    [agentId, normalized, VIDEO_POST_STATUS.PUBLISHED],
  );
  return rows[0] || null;
}

/**
 * Generate a unique slug for a video post under one agent. If the slugified
 * base is already taken, appends -2, -3, … so agents can have multiple video
 * posts with similar titles without collision.
 */
export async function generateUniqueVideoPostSlug(agentId, baseTitle, ignoreVideoPostId = null) {
  const base = String(baseTitle || "video")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "video";

  for (let attempt = 1; attempt <= 25; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const params = [agentId, candidate];
    if (ignoreVideoPostId) params.push(ignoreVideoPostId);
    const rows = await query(
      `SELECT id FROM video_posts WHERE agent_id = ? AND slug = ?${
        ignoreVideoPostId ? " AND id <> ?" : ""
      } LIMIT 1`,
      params,
    );
    if (!rows[0]) return candidate;
  }

  return `${base}-${Date.now()}`;
}

export async function createVideoPost(agentId, data) {
  const result = await query(
    `INSERT INTO video_posts
      (agent_id, title, slug, description, video_url, thumbnail_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      agentId,
      data.title,
      data.slug,
      data.description || null,
      data.video_url || null,
      data.thumbnail_url || null,
      data.status || VIDEO_POST_STATUS.DRAFT,
    ],
  );
  return { ok: true, id: result.insertId };
}

export async function updateVideoPost(agentId, videoPostId, data) {
  const existing = await getVideoPostForAgent(agentId, videoPostId);
  if (!existing) {
    return { ok: false, status: 404, error: "Video post not found." };
  }

  await query(
    `UPDATE video_posts
     SET title = ?, slug = ?, description = ?, status = ?
     WHERE id = ? AND agent_id = ?`,
    [
      data.title,
      data.slug,
      data.description || null,
      data.status || existing.status,
      videoPostId,
      agentId,
    ],
  );

  return { ok: true };
}

export async function deleteVideoPost(agentId, videoPostId) {
  const existing = await getVideoPostForAgent(agentId, videoPostId);
  if (!existing) {
    return { ok: false, status: 404, error: "Video post not found." };
  }

  await query("DELETE FROM video_posts WHERE id = ? AND agent_id = ?", [
    videoPostId,
    agentId,
  ]);

  return { ok: true, video_url: existing.video_url, thumbnail_url: existing.thumbnail_url };
}
