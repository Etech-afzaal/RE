import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import {
  deleteFilesUpdate,
  getFilesUpdateForAgent,
  upsertFilesUpdate,
} from "@/lib/filesUpdates";
import { FILES_UPDATE_STATUS } from "@/lib/filesUpdateStatus";
import {
  validateFilesUpdateInput,
  validateFilesUpdateStatus,
} from "@/lib/validators/filesUpdateValidator";

function agentIdFrom(session) {
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

export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const filesUpdate = await getFilesUpdateForAgent(agentId);

  return NextResponse.json({ filesUpdate });
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

  const statusCheck = validateFilesUpdateStatus(body.status);
  if (!statusCheck.ok) {
    return NextResponse.json({ error: statusCheck.error }, { status: 400 });
  }
  const nextStatus = statusCheck.value;

  const validated = validateFilesUpdateInput(body, {
    requireContent: nextStatus === FILES_UPDATE_STATUS.PUBLISHED,
  });
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, ...(validated.field ? { field: validated.field } : {}) },
      { status: 400 },
    );
  }

  const result = await upsertFilesUpdate(agentId, {
    title: validated.data.title,
    content: validated.data.content,
    status: nextStatus,
  });

  const actorName = agentDisplayName(session);
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: result.created
      ? AUDIT_ACTIONS.FILES_UPDATE_CREATED
      : AUDIT_ACTIONS.FILES_UPDATE_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.FILES_UPDATE,
    entityId: result.id,
    description: `${actorName} ${result.created ? "created" : "updated"} files rates "${validated.data.title}"`,
    metadata: {
      files_update_title: validated.data.title,
      actor_name: actorName,
      agent_name: actorName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
      status: nextStatus,
    },
    ipAddress: getRequestIp(req),
  });

  revalidatePath(`/re/${encodeURIComponent(agentHandle)}`, "page");
  revalidatePath(`/re/${encodeURIComponent(agentHandle)}/files-updates`, "page");

  return NextResponse.json({ success: true, id: result.id, created: result.created, status: nextStatus });
}

export async function DELETE(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const existing = await getFilesUpdateForAgent(agentId);
  if (!existing) {
    return NextResponse.json({ error: "Files rates not found." }, { status: 404 });
  }

  await deleteFilesUpdate(agentId);

  const actorName = agentDisplayName(session);
  const agentHandle = session.user.username || session.user.estate_name || null;
  await createAuditLog({
    userId: agentId,
    action: AUDIT_ACTIONS.FILES_UPDATE_DELETED,
    entityType: AUDIT_ENTITY_TYPES.FILES_UPDATE,
    entityId: existing.id,
    description: `${actorName} deleted files rates "${existing.title}"`,
    metadata: {
      files_update_title: existing.title,
      actor_name: actorName,
      agent_name: actorName,
      agent_username: agentHandle,
      estate_name: session.user.estate_name || agentHandle,
    },
    ipAddress: getRequestIp(req),
  });

  revalidatePath(`/re/${encodeURIComponent(agentHandle)}`, "page");
  revalidatePath(`/re/${encodeURIComponent(agentHandle)}/files-updates`, "page");

  return NextResponse.json({ success: true });
}
