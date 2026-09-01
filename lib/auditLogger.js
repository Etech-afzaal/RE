import { query } from "@/lib/db";
import {
  agentPublicUsername,
  getPropertyUrl,
} from "@/lib/propertySlug";

/** Machine-readable audit actions used across the platform. */
export const AUDIT_ACTIONS = {
  PROPERTY_CREATED: "PROPERTY_CREATED",
  PROPERTY_SUBMITTED: "PROPERTY_SUBMITTED",
  PROPERTY_APPROVAL_CANCELLED: "PROPERTY_APPROVAL_CANCELLED",
  PROPERTY_APPROVED: "PROPERTY_APPROVED",
  PROPERTY_REJECTED: "PROPERTY_REJECTED",
  PROPERTY_UPDATED: "PROPERTY_UPDATED",
  PROPERTY_DELETED: "PROPERTY_DELETED",
  PROPERTY_IMAGES_UPLOADED: "PROPERTY_IMAGES_UPLOADED",
  PROPERTY_VIDEO_UPLOADED: "PROPERTY_VIDEO_UPLOADED",
  AGENT_SIGNUP_REQUESTED: "AGENT_SIGNUP_REQUESTED",
  AGENT_APPROVED: "AGENT_APPROVED",
  AGENT_DISABLED: "AGENT_DISABLED",
  AGENT_BLOCKED: "AGENT_BLOCKED",
  AGENT_ENABLED: "AGENT_ENABLED",
  AGENT_PROFILE_UPDATED: "AGENT_PROFILE_UPDATED",
  SUBAGENT_CREATED: "SUBAGENT_CREATED",
  SUBAGENT_UPDATED: "SUBAGENT_UPDATED",
  SUBAGENT_DELETED: "SUBAGENT_DELETED",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGOUT: "LOGOUT",
  COMPANY_LOGO_CHANGED: "COMPANY_LOGO_CHANGED",
  COMPANY_BRANDING_UPDATED: "COMPANY_BRANDING_UPDATED",
};

/** Short labels for tables and the Overview feed. */
export const AUDIT_ACTION_LABELS = {
  [AUDIT_ACTIONS.PROPERTY_CREATED]: "Added Property",
  [AUDIT_ACTIONS.PROPERTY_SUBMITTED]: "Submitted Property",
  [AUDIT_ACTIONS.PROPERTY_APPROVAL_CANCELLED]: "Cancelled Approval Request",
  [AUDIT_ACTIONS.PROPERTY_APPROVED]: "Approved Property",
  [AUDIT_ACTIONS.PROPERTY_REJECTED]: "Rejected Property",
  [AUDIT_ACTIONS.PROPERTY_UPDATED]: "Updated Property",
  [AUDIT_ACTIONS.PROPERTY_DELETED]: "Deleted Property",
  [AUDIT_ACTIONS.PROPERTY_IMAGES_UPLOADED]: "Uploaded Images",
  [AUDIT_ACTIONS.PROPERTY_VIDEO_UPLOADED]: "Uploaded Video",
  [AUDIT_ACTIONS.AGENT_SIGNUP_REQUESTED]: "Access Request",
  [AUDIT_ACTIONS.AGENT_APPROVED]: "Approved Agent",
  [AUDIT_ACTIONS.AGENT_DISABLED]: "Disabled Agent",
  [AUDIT_ACTIONS.AGENT_BLOCKED]: "Blocked Agent",
  [AUDIT_ACTIONS.AGENT_ENABLED]: "Enabled Agent",
  [AUDIT_ACTIONS.AGENT_PROFILE_UPDATED]: "Updated Profile",
  [AUDIT_ACTIONS.SUBAGENT_CREATED]: "Added Subagent",
  [AUDIT_ACTIONS.SUBAGENT_UPDATED]: "Updated Subagent",
  [AUDIT_ACTIONS.SUBAGENT_DELETED]: "Deleted Subagent",
  [AUDIT_ACTIONS.LOGIN_SUCCESS]: "Signed In",
  [AUDIT_ACTIONS.LOGOUT]: "Signed Out",
  [AUDIT_ACTIONS.COMPANY_LOGO_CHANGED]: "Changed Logo",
  [AUDIT_ACTIONS.COMPANY_BRANDING_UPDATED]: "Updated Branding",
};

export const AUDIT_ENTITY_TYPES = {
  PROPERTY: "property",
  USER: "user",
  SIGNUP_REQUEST: "signup_request",
  BRANDING: "branding",
  AUTH: "auth",
  SUBAGENT: "subagent",
};

/** Filter buckets used by the Logs page. */
export const AUDIT_ACTIVITY_CATEGORIES = {
  properties: [AUDIT_ENTITY_TYPES.PROPERTY],
  agents: [
    AUDIT_ENTITY_TYPES.USER,
    AUDIT_ENTITY_TYPES.SIGNUP_REQUEST,
    AUDIT_ENTITY_TYPES.SUBAGENT,
  ],
  authentication: [AUDIT_ENTITY_TYPES.AUTH],
  system: [AUDIT_ENTITY_TYPES.BRANDING],
};

/**
 * Best-effort client IP from a Fetch Request.
 * @param {Request|null|undefined} req
 * @returns {string|null}
 */
export function getRequestIp(req) {
  try {
    const headers = req?.headers;
    if (!headers?.get) return null;
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      return String(forwarded).split(",")[0].trim().slice(0, 45) || null;
    }
    const realIp = headers.get("x-real-ip");
    return realIp ? String(realIp).trim().slice(0, 45) : null;
  } catch {
    return null;
  }
}

function parseMetadata(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * Persist one audit log row. Never throws — logging must not break primary flows.
 *
 * @param {{
 *   userId?: number|string|null,
 *   action: string,
 *   entityType?: string|null,
 *   entityId?: number|string|null,
 *   description: string,
 *   metadata?: object|null,
 *   ipAddress?: string|null,
 * }} params
 */
export async function createAuditLog({
  userId = null,
  action,
  entityType = null,
  entityId = null,
  description,
  metadata = null,
  ipAddress = null,
}) {
  if (!action || !description) return null;

  try {
    const uid =
      userId == null || userId === ""
        ? null
        : Number.isFinite(Number(userId))
          ? Number(userId)
          : null;
    const eid =
      entityId == null || entityId === ""
        ? null
        : Number.isFinite(Number(entityId))
          ? Number(entityId)
          : null;

    const result = await query(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, description, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        String(action).slice(0, 100),
        entityType ? String(entityType).slice(0, 50) : null,
        eid,
        String(description).slice(0, 4000),
        metadata ? JSON.stringify(metadata) : null,
        ipAddress ? String(ipAddress).slice(0, 45) : null,
      ],
    );
    return result.insertId ?? null;
  } catch (err) {
    console.error("Failed to create audit log:", err);
    return null;
  }
}

/**
 * Public / profile URL for an audit log row (new-tab navigation).
 * @param {{ entity_type?: string|null, entity_id?: number|null, metadata?: any }} log
 * @returns {string|null}
 */
export function auditLogHref(log) {
  const meta = parseMetadata(log?.metadata);
  const entityType = log?.entity_type;
  const entityId = log?.entity_id != null ? Number(log.entity_id) : null;

  if (entityType === AUDIT_ENTITY_TYPES.PROPERTY && entityId) {
    const handle =
      meta.agent_username ||
      meta.agent_estate ||
      meta.username ||
      meta.estate_name ||
      "";
    if (!handle) return null;
    return getPropertyUrl({
      id: entityId,
      title: meta.property_title || "property",
      estate_name: handle,
      username: handle,
    });
  }

  if (
    entityType === AUDIT_ENTITY_TYPES.USER ||
    entityType === AUDIT_ENTITY_TYPES.BRANDING
  ) {
    const handle =
      meta.agent_username ||
      meta.username ||
      meta.estate_name ||
      agentPublicUsername(meta);
    if (!handle) return null;
    return `/re/${encodeURIComponent(handle)}`;
  }

  return null;
}

/**
 * Map a DB audit_logs row (+ joined user fields) into the Overview activity shape.
 */
export function toActivityItem(row) {
  const meta = parseMetadata(row.metadata);
  const userName =
    row.user_name ||
    meta.actor_name ||
    (row.user_type === "superadmin" ? "Superadmin" : null) ||
    "System";
  const actionLabel =
    AUDIT_ACTION_LABELS[row.action] ||
    String(row.action || "Activity").replace(/_/g, " ");
  const details =
    meta.property_title ||
    meta.estate_name ||
    meta.agent_name ||
    meta.detail ||
    row.description ||
    "—";

  return {
    id: `audit-${row.id}`,
    type: row.entity_type || "system",
    title: row.description,
    detail: details,
    user: userName,
    action: actionLabel,
    details,
    propertyId:
      row.entity_type === AUDIT_ENTITY_TYPES.PROPERTY
        ? Number(row.entity_id) || null
        : null,
    href: auditLogHref(row),
    at: row.created_at,
  };
}

/**
 * Map a DB row for the Logs table UI.
 */
export function toLogListItem(row) {
  const meta = parseMetadata(row.metadata);
  const userName =
    row.user_name ||
    meta.actor_name ||
    (row.user_type === "superadmin" ? "Superadmin" : null) ||
    "System";

  return {
    id: Number(row.id),
    createdAt: row.created_at,
    user: userName,
    userId: row.user_id != null ? Number(row.user_id) : null,
    action: row.action,
    activity: AUDIT_ACTION_LABELS[row.action] || row.action,
    entityType: row.entity_type,
    entityId: row.entity_id != null ? Number(row.entity_id) : null,
    description: row.description,
    metadata: meta,
    ipAddress: row.ip_address,
    href: auditLogHref(row),
  };
}
