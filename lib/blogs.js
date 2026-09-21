import { query } from "@/lib/db";
import { BLOG_STATUS } from "@/lib/blogStatus";

const BLOG_SELECT =
  "id, agent_id, title, slug, short_description, content, cover_image, status, created_at, updated_at";

const BLOG_PUBLIC_SELECT =
  "id, agent_id, title, slug, short_description, content, cover_image, status, created_at, updated_at";

/**
 * One page of an agent's own blogs (any status) for the dashboard.
 * Mirrors lib/queries.js#getManagedPropertiesPageByAgent and
 * lib/subagents.js#getSubagentsPageByAgent so the dashboard uses the
 * same pagination shape and page size.
 */
export async function getBlogsPageByAgent(
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
    filters.push("(title LIKE ? OR short_description LIKE ?)");
    params.push(like, like);
  }

  const where = filters.join(" AND ");
  const countRows = await query(
    `SELECT COUNT(*) AS total FROM blogs WHERE ${where}`,
    params,
  );
  const totalBlogs = Number(countRows[0]?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(totalBlogs / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const offset = (currentPage - 1) * safePageSize;

  const blogs = await query(
    `SELECT ${BLOG_SELECT}
     FROM blogs
     WHERE ${where}
     ORDER BY updated_at DESC, created_at DESC
     LIMIT ${safePageSize} OFFSET ${offset}`,
    params,
  );

  return {
    blogs,
    currentPage,
    totalBlogs,
    totalPages,
  };
}

/**
 * Single blog owned by an agent (any status). Used by the dashboard edit
 * page and the agent-facing GET API.
 */
export async function getBlogForAgent(agentId, blogId) {
  const rows = await query(
    `SELECT ${BLOG_SELECT}
     FROM blogs
     WHERE id = ? AND agent_id = ?
     LIMIT 1`,
    [blogId, agentId],
  );
  return rows[0] || null;
}

/**
 * Published blogs for an agent's public website, newest first.
 * Never returns draft blogs.
 */
export async function getPublishedBlogsByAgent(agentId, { limit } = {}) {
  const safeLimit =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.min(50, Math.max(1, Number(limit)))
      : 50;

  return query(
    `SELECT ${BLOG_PUBLIC_SELECT}
     FROM blogs
     WHERE agent_id = ? AND status = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ${safeLimit}`,
    [agentId, BLOG_STATUS.PUBLISHED],
  );
}

/**
 * Public blog lookup by agent id + slug. Only published blogs are returned
 * so draft URLs never resolve on the public site.
 */
export async function getPublishedBlogByAgentAndSlug(agentId, slug) {
  const normalized = String(slug || "").trim();
  if (!normalized) return null;

  const rows = await query(
    `SELECT ${BLOG_PUBLIC_SELECT}
     FROM blogs
     WHERE agent_id = ? AND slug = ? AND status = ?
     LIMIT 1`,
    [agentId, normalized, BLOG_STATUS.PUBLISHED],
  );
  return rows[0] || null;
}

/**
 * Generate a unique slug for a blog under one agent. If the slugified base
 * is already taken, appends -2, -3, … so agents can have multiple blogs
 * with similar titles without collision.
 */
export async function generateUniqueBlogSlug(agentId, baseTitle, ignoreBlogId = null) {
  const base = String(baseTitle || "blog")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "blog";

  for (let attempt = 1; attempt <= 25; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const params = [agentId, candidate];
    if (ignoreBlogId) params.push(ignoreBlogId);
    const rows = await query(
      `SELECT id FROM blogs WHERE agent_id = ? AND slug = ?${
        ignoreBlogId ? " AND id <> ?" : ""
      } LIMIT 1`,
      params,
    );
    if (!rows[0]) return candidate;
  }

  // Extremely unlikely fallback — keeps the insert unique even when 25
  // near-identical titles exist.
  return `${base}-${Date.now()}`;
}

export async function createBlog(agentId, data) {
  const result = await query(
    `INSERT INTO blogs
      (agent_id, title, slug, short_description, content, cover_image, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      agentId,
      data.title,
      data.slug,
      data.short_description || null,
      data.content || null,
      data.cover_image || null,
      data.status || BLOG_STATUS.DRAFT,
    ],
  );
  return { ok: true, id: result.insertId };
}

export async function updateBlog(agentId, blogId, data) {
  const existing = await getBlogForAgent(agentId, blogId);
  if (!existing) {
    return { ok: false, status: 404, error: "Blog not found." };
  }

  await query(
    `UPDATE blogs
     SET title = ?, slug = ?, short_description = ?, content = ?, cover_image = ?, status = ?
     WHERE id = ? AND agent_id = ?`,
    [
      data.title,
      data.slug,
      data.short_description || null,
      data.content || null,
      data.cover_image ?? existing.cover_image,
      data.status || existing.status,
      blogId,
      agentId,
    ],
  );

  return { ok: true };
}

export async function deleteBlog(agentId, blogId) {
  const existing = await getBlogForAgent(agentId, blogId);
  if (!existing) {
    return { ok: false, status: 404, error: "Blog not found." };
  }

  await query("DELETE FROM blogs WHERE id = ? AND agent_id = ?", [
    blogId,
    agentId,
  ]);

  return { ok: true, cover_image: existing.cover_image };
}
