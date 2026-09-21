import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import {
  createBlog,
  generateUniqueBlogSlug,
  getBlogsPageByAgent,
} from "@/lib/blogs";
import { BLOG_STATUS } from "@/lib/blogStatus";
import { sanitizeSearchInput } from "@/lib/validators/common";
import {
  slugifyBlogTitle,
  validateBlogInput,
  validateBlogStatus,
} from "@/lib/validators/blogValidator";

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = sanitizeSearchInput(searchParams.get("search")).value;
  const page = searchParams.get("page");

  const payload = await getBlogsPageByAgent(agentId, {
    page,
    pageSize: 10,
    status,
    search,
  });

  return NextResponse.json(payload);
}

export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
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

  const slug = await generateUniqueBlogSlug(agentId, validated.data.title);

  const result = await createBlog(agentId, {
    title: validated.data.title,
    slug,
    short_description: validated.data.short_description,
    content: validated.data.content,
    cover_image: null,
    status: nextStatus,
  });

  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.BLOG_CREATED,
    entityType: AUDIT_ENTITY_TYPES.BLOG,
    entityId: result.id,
    description: `${agentName} created blog "${validated.data.title}"`,
    metadata: {
      property_title: validated.data.title,
      blog_title: validated.data.title,
      blog_slug: slug,
      actor_name: agentName,
      agent_name: agentName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      status: nextStatus,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true, id: result.id, slug, status: nextStatus });
}
