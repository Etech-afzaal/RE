import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import {
  createVideoPost,
  generateUniqueVideoPostSlug,
  getVideoPostsPageByAgent,
} from "@/lib/videoPosts";
import { VIDEO_POST_STATUS } from "@/lib/videoPostStatus";
import { sanitizeSearchInput } from "@/lib/validators/common";
import {
  slugifyVideoPostTitle,
  validateVideoPostInput,
  validateVideoPostStatus,
} from "@/lib/validators/videoPostValidator";

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

  const payload = await getVideoPostsPageByAgent(agentId, {
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

  const statusCheck = validateVideoPostStatus(body.status);
  if (!statusCheck.ok) {
    return NextResponse.json({ error: statusCheck.error }, { status: 400 });
  }
  const nextStatus = statusCheck.value;

  const validated = validateVideoPostInput(body, {
    requireVideo: nextStatus === VIDEO_POST_STATUS.PUBLISHED,
  });
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, ...(validated.field ? { field: validated.field } : {}) },
      { status: 400 },
    );
  }

  const slug = await generateUniqueVideoPostSlug(agentId, validated.data.title);

  const result = await createVideoPost(agentId, {
    title: validated.data.title,
    slug,
    description: validated.data.description,
    video_source: validated.data.video_source,
    video_url: null,
    youtube_video_id: validated.data.youtube_video_id || null,
    thumbnail_url: validated.data.thumbnail_url || null,
    status: nextStatus,
  });

  const agentName = session.user.name || "Agent";
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.VIDEO_POST_CREATED,
    entityType: AUDIT_ENTITY_TYPES.VIDEO_POST,
    entityId: result.id,
    description: `${agentName} created video post "${validated.data.title}"`,
    metadata: {
      video_post_title: validated.data.title,
      video_post_slug: slug,
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
