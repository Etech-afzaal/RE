/**
 * Phase 1 status constants + legacy UI compatibility.
 *
 * DB uses: agents pending|approved|rejected|disabled
 *           properties draft|pending_approval|approved|rejected|sold|hidden
 *
 * Existing admin UI still sends/reads "active" for live agents/listings.
 * Map at the API boundary so pages do not need redesign in this phase.
 */

export const AGENT_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  DISABLED: "disabled",
};

export const PROPERTY_STATUS = {
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  SOLD: "sold",
  HIDDEN: "hidden",
};

/** Status values that mean "live / publicly visible" after Phase 1. */
export const AGENT_LIVE_STATUS = AGENT_STATUS.APPROVED;
export const PROPERTY_PUBLIC_STATUS = PROPERTY_STATUS.APPROVED;

export function isAgentLive(status) {
  return status === AGENT_LIVE_STATUS;
}

export function isPropertyPublic(status) {
  return status === PROPERTY_PUBLIC_STATUS;
}

/** Map client/UI agent status → DB value. */
export function toDbAgentStatus(clientStatus) {
  if (clientStatus === "active") return AGENT_STATUS.APPROVED;
  return clientStatus;
}

/** Map DB agent status → client/UI value (keeps existing admin screens working). */
export function toClientAgentStatus(dbStatus) {
  if (dbStatus === AGENT_STATUS.APPROVED) return "active";
  return dbStatus;
}

/** Map client/UI property status → DB value. */
export function toDbPropertyStatus(clientStatus) {
  if (clientStatus === "active") return PROPERTY_STATUS.APPROVED;
  return clientStatus;
}

/** Map DB property status → client/UI value. */
export function toClientPropertyStatus(dbStatus) {
  if (dbStatus === PROPERTY_STATUS.APPROVED) return "active";
  return dbStatus;
}

export const AGENT_DB_STATUSES = new Set(Object.values(AGENT_STATUS));
export const PROPERTY_DB_STATUSES = new Set(Object.values(PROPERTY_STATUS));

/** Statuses the admin property PATCH endpoint accepts (legacy + new). */
export const PROPERTY_STATUS_INPUTS = new Set([
  "active", // legacy UI → approved
  ...PROPERTY_DB_STATUSES,
]);

/** Statuses the admin agent PATCH endpoint accepts (legacy + new). */
export const AGENT_STATUS_INPUTS = new Set([
  "active", // legacy UI → approved
  ...AGENT_DB_STATUSES,
]);
