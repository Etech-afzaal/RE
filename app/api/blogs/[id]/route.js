import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import {
  deleteBlog,
  generateUniqueBlogSlug,
  getBlogForAgent,
  updateBlog,
} from "@/lib/blogs";
import { BLOG_STATUS } from "@/lib/blogStatus";
import {
  slugifyBlogTitle,
  validateBlogInput,
  validateBlogStatus,
} from "@/lib/validators/blogValidator";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

function agentDisplayName(session) {
  return (
    session?.user?.name ||
    session?.user?.full_name ||
    session?.user?.email ||
    "Agent"
  );
}

function parseBlogId(params) {
  const blogId = Number(params.id);
  if (!Number.isInteger(blogId) || blogId <= 0) return null;
  return blogId;
}

export async function GET(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const blogId = parseBlogId(params);
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog." }, { status: 400 });
  }

  const blog = await getBlogForAgent(agentId, blogId);
  if (!blog) {
    return NextResponse.json({ error: "Blog not found." }, { status: 404 });
  }

  return NextResponse.json({ blog });
}

export async function PATCH(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const blogId = parseBlogId(params);
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog." }, { status: 400 });
  }

  const existing = await getBlogForAgent(agentId, blogId);
  if (!existing) {
    return NextResponse.json({ error: "Blog not found." }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  if (Object.keys(body).length === 1 && Object.prototype.hasOwnProperty.call(body, "status")) {
    const statusCheck = validateBlogStatus(body.status);
    if (!statusCheck.ok) {
      return NextResponse.json({ error: statusCheck.error }, { status: 400 });
    }
    const nextStatus = statusCheck.value;
    const validated = validateBlogInput(existing, {
      requireContent: nextStatus === BLOG_STATUS.PUBLISHED,
    });
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error, ...(validated.field ? { field: validated.field } : {}) },
        { status: 400 },
      );
    }

    const result = await updateBlog(agentId, blogId, {
      title: existing.title,
      slug: existing.slug,
      short_description: existing.short_description,
      content: existing.content,
      cover_image: existing.cover_image,
      status: nextStatus,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const actorName = agentDisplayName(session);
    await createAuditLog({
      userId: Number(session?.user?.id) || null,
      action: AUDIT_ACTIONS.BLOG_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.BLOG,
      entityId: blogId,
      description: `${actorName} ${nextStatus === BLOG_STATUS.PUBLISHED ? "published" : "unpublished"} blog "${existing.title}"`,
      metadata: {
        blog_title: existing.title,
        blog_slug: existing.slug,
        actor_name: actorName,
        old_status: existing.status,
        new_status: nextStatus,
      },
      ipAddress: getRequestIp(req),
    });

    const blog = await getBlogForAgent(agentId, blogId);
    return NextResponse.json({ success: true, blog });
  }

  const statusCheck = validateBlogStatus(body.status);
  if (!statusCheck.ok) {
    return NextResponse.json({ error: statusCheck.error }, { status: 400 });
  }
  const nextStatus = statusCheck.value;

  const validated = validateBlogInput(body, {
    requireContent: nextStatus === BLOG_STATUS.PUBLISHED,
  });
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, ...(validated.field ? { field: validated.field } : {}) },
      { status: 400 },
    );
  }

  // Regenerate the slug only when the title changed; otherwise keep the
  // existing slug so public blog URLs remain stable.
  let slug = existing.slug;
  const newSlugBase = slugifyBlogTitle(validated.data.title);
  if (newSlugBase !== existing.slug && existing.title !== validated.data.title) {
    slug = await generateUniqueBlogSlug(agentId, validated.data.title, blogId);
  }

  const result = await updateBlog(agentId, blogId, {
    title: validated.data.title,
    slug,
    short_description: validated.data.short_description,
    content: validated.data.content,
    cover_image: body.cover_image !== undefined ? body.cover_image : existing.cover_image,
    status: nextStatus,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const actorName = agentDisplayName(session);
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: Number(session?.user?.id) || null,
    action: AUDIT_ACTIONS.BLOG_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.BLOG,
    entityId: blogId,
    description: `${actorName} updated blog "${validated.data.title}"`,
    metadata: {
      blog_title: validated.data.title,
      blog_slug: slug,
      actor_name: actorName,
      agent_name: actorName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      status: nextStatus,
    },
    ipAddress: getRequestIp(req),
  });

  const blog = await getBlogForAgent(agentId, blogId);
  return NextResponse.json({ success: true, blog });
}

export async function DELETE(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const blogId = parseBlogId(params);
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog." }, { status: 400 });
  }

  const existing = await getBlogForAgent(agentId, blogId);
  if (!existing) {
    return NextResponse.json({ error: "Blog not found." }, { status: 404 });
  }

  const result = await deleteBlog(agentId, blogId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const actorName = agentDisplayName(session);
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: Number(session?.user?.id) || null,
    action: AUDIT_ACTIONS.BLOG_DELETED,
    entityType: AUDIT_ENTITY_TYPES.BLOG,
    entityId: blogId,
    description: `${actorName} deleted blog "${existing.title}"`,
    metadata: {
      blog_title: existing.title,
      blog_slug: existing.slug,
      actor_name: actorName,
      agent_name: actorName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true });
}
