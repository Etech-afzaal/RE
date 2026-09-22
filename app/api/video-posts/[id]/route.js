import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import {
  deleteVideoPost,
  generateUniqueVideoPostSlug,
  getVideoPostForAgent,
  updateVideoPost,
} from "@/lib/videoPosts";
import { VIDEO_POST_STATUS } from "@/lib/videoPostStatus";
import {
  slugifyVideoPostTitle,
  validateVideoPostInput,
  validateVideoPostStatus,
} from "@/lib/validators/videoPostValidator";

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

function parseVideoPostId(params) {
  const videoPostId = Number(params.id);
  if (!Number.isInteger(videoPostId) || videoPostId <= 0) return null;
  return videoPostId;
}

export async function GET(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const videoPostId = parseVideoPostId(params);
  if (!videoPostId) {
    return NextResponse.json({ error: "Invalid video post." }, { status: 400 });
  }

  const videoPost = await getVideoPostForAgent(agentId, videoPostId);
  if (!videoPost) {
    return NextResponse.json({ error: "Video post not found." }, { status: 404 });
  }

  return NextResponse.json({ videoPost });
}

export async function PATCH(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const videoPostId = parseVideoPostId(params);
  if (!videoPostId) {
    return NextResponse.json({ error: "Invalid video post." }, { status: 400 });
  }

  const existing = await getVideoPostForAgent(agentId, videoPostId);
  if (!existing) {
    return NextResponse.json({ error: "Video post not found." }, { status: 404 });
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
    const statusCheck = validateVideoPostStatus(body.status);
    if (!statusCheck.ok) {
      return NextResponse.json({ error: statusCheck.error }, { status: 400 });
    }
    const nextStatus = statusCheck.value;
    const validated = validateVideoPostInput(existing, {
      requireVideo: nextStatus === VIDEO_POST_STATUS.PUBLISHED && !existing.video_url,
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error, ...(validated.field ? { field: validated.field } : {}) }, { status: 400 });
    }
    const result = await updateVideoPost(agentId, videoPostId, {
      title: existing.title,
      slug: existing.slug,
      description: existing.description,
      status: nextStatus,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const actorName = agentDisplayName(session);
    await createAuditLog({
      userId: Number(session?.user?.id) || null,
      action: AUDIT_ACTIONS.VIDEO_POST_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.VIDEO_POST,
      entityId: videoPostId,
      description: `${actorName} ${nextStatus === VIDEO_POST_STATUS.PUBLISHED ? "published" : "unpublished"} video post "${existing.title}"`,
      metadata: { video_post_title: existing.title, video_post_slug: existing.slug, old_status: existing.status, new_status: nextStatus },
      ipAddress: getRequestIp(req),
    });
    const videoPost = await getVideoPostForAgent(agentId, videoPostId);
    return NextResponse.json({ success: true, videoPost });
  }

  const statusCheck = validateVideoPostStatus(body.status);
  if (!statusCheck.ok) {
    return NextResponse.json({ error: statusCheck.error }, { status: 400 });
  }
  const nextStatus = statusCheck.value;

  const validated = validateVideoPostInput(body, {
    requireVideo:
      nextStatus === VIDEO_POST_STATUS.PUBLISHED && !existing.video_url,
  });
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, ...(validated.field ? { field: validated.field } : {}) },
      { status: 400 },
    );
  }

  // Regenerate the slug only when the title changed; otherwise keep the
  // existing slug so public video URLs remain stable.
  let slug = existing.slug;
  const newSlugBase = slugifyVideoPostTitle(validated.data.title);
  if (newSlugBase !== existing.slug && existing.title !== validated.data.title) {
    slug = await generateUniqueVideoPostSlug(agentId, validated.data.title, videoPostId);
  }

  const result = await updateVideoPost(agentId, videoPostId, {
    title: validated.data.title,
    slug,
    description: validated.data.description,
    status: nextStatus,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const actorName = agentDisplayName(session);
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: Number(session?.user?.id) || null,
    action: AUDIT_ACTIONS.VIDEO_POST_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.VIDEO_POST,
    entityId: videoPostId,
    description: `${actorName} updated video post "${validated.data.title}"`,
    metadata: {
      video_post_title: validated.data.title,
      video_post_slug: slug,
      actor_name: actorName,
      agent_name: actorName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      status: nextStatus,
    },
    ipAddress: getRequestIp(req),
  });

  const videoPost = await getVideoPostForAgent(agentId, videoPostId);
  return NextResponse.json({ success: true, videoPost });
}

export async function DELETE(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const videoPostId = parseVideoPostId(params);
  if (!videoPostId) {
    return NextResponse.json({ error: "Invalid video post." }, { status: 400 });
  }

  const existing = await getVideoPostForAgent(agentId, videoPostId);
  if (!existing) {
    return NextResponse.json({ error: "Video post not found." }, { status: 404 });
  }

  const result = await deleteVideoPost(agentId, videoPostId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const actorName = agentDisplayName(session);
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: Number(session?.user?.id) || null,
    action: AUDIT_ACTIONS.VIDEO_POST_DELETED,
    entityType: AUDIT_ENTITY_TYPES.VIDEO_POST,
    entityId: videoPostId,
    description: `${actorName} deleted video post "${existing.title}"`,
    metadata: {
      video_post_title: existing.title,
      video_post_slug: existing.slug,
      actor_name: actorName,
      agent_name: actorName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json({ success: true });
}
