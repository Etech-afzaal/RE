/**
 * Phase 1 status constants + legacy UI compatibility.
 *
 * DB uses: agents pending|approved|rejected|disabled|blocked
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
  BLOCKED: "blocked",
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

export function isAgentBlocked(status) {
  return status === AGENT_STATUS.BLOCKED;
}

export function isAgentDisabled(status) {
  return status === AGENT_STATUS.DISABLED;
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

/* -------------------------------------------------------------------------
 * Approval workflow
 *
 * draft ──submit──► pending_approval ──approve──► approved
 *   ▲                      │
 *   └──── rejected ◄──reject┘   (agent edits, then resubmits)
 * ---------------------------------------------------------------------- */

/** Statuses an agent may submit for admin review from. */
export const PROPERTY_SUBMITTABLE_STATUSES = new Set([
  PROPERTY_STATUS.DRAFT,
  PROPERTY_STATUS.REJECTED,
]);

/** The only two outcomes of an admin review. */
export const PROPERTY_REVIEW_DECISIONS = new Set([
  PROPERTY_STATUS.APPROVED,
  PROPERTY_STATUS.REJECTED,
]);

export function canAgentSubmitFrom(status) {
  return PROPERTY_SUBMITTABLE_STATUSES.has(status);
}

/** A listing awaiting review is frozen so its content matches what admin sees. */
export function isPropertyLockedForAgent(status) {
  return status === PROPERTY_STATUS.PENDING_APPROVAL;
}

/** Shared 409 body when an agent tries to mutate a locked listing. */
export const PROPERTY_LOCKED_MESSAGE =
  "This property is awaiting admin review and cannot be edited right now.";

/**
 * Status changes an agent may make directly through the property PUT endpoint.
 * pending_approval is deliberately absent: submitting requires validation and
 * only the submit endpoint may set it. approved is only reachable again from
 * sold/hidden, i.e. re-listing something an admin already cleared.
 */
const AGENT_TRANSITIONS = {
  [PROPERTY_STATUS.DRAFT]: [PROPERTY_STATUS.DRAFT],
  [PROPERTY_STATUS.REJECTED]: [PROPERTY_STATUS.REJECTED, PROPERTY_STATUS.DRAFT],
  [PROPERTY_STATUS.PENDING_APPROVAL]: [PROPERTY_STATUS.PENDING_APPROVAL],
  [PROPERTY_STATUS.APPROVED]: [
    PROPERTY_STATUS.APPROVED,
    PROPERTY_STATUS.SOLD,
    PROPERTY_STATUS.HIDDEN,
  ],
  [PROPERTY_STATUS.SOLD]: [
    PROPERTY_STATUS.SOLD,
    PROPERTY_STATUS.HIDDEN,
    PROPERTY_STATUS.APPROVED,
  ],
  [PROPERTY_STATUS.HIDDEN]: [
    PROPERTY_STATUS.HIDDEN,
    PROPERTY_STATUS.SOLD,
    PROPERTY_STATUS.APPROVED,
  ],
};

export function canAgentTransition(current, next) {
  if (current === next) return true;
  return (AGENT_TRANSITIONS[current] || []).includes(next);
}
