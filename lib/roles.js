/**
 * Phase 2 — canonical roles for Dhalahore.
 *
 * Stored in JWT/session as SUPER_ADMIN | AGENT.
 * Legacy values "admin" | "agent" (pre-Phase-2 tokens / login hints) are normalized.
 */

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  AGENT: "AGENT",
};

/** Login credential hints still sent by existing login forms. */
export const LOGIN_HINTS = {
  ADMIN: "admin",
  AGENT: "agent",
};

/**
 * Normalize any role string from credentials, JWT, or session.
 * @param {unknown} role
 * @returns {string|null}
 */
export function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");

  if (!value) return null;
  if (value === "ADMIN" || value === "SUPER_ADMIN" || value === "SUPERADMIN") {
    return ROLES.SUPER_ADMIN;
  }
  if (value === "AGENT") {
    return ROLES.AGENT;
  }
  return value;
}

export function isSuperAdmin(role) {
  return normalizeRole(role) === ROLES.SUPER_ADMIN;
}

export function isAgentRole(role) {
  return normalizeRole(role) === ROLES.AGENT;
}

/**
 * Map login form hint (admin|agent) → canonical role for authorize().
 * @param {unknown} hint
 * @returns {"admin"|"agent"|null} internal authorize branch key
 */
export function resolveLoginHint(hint) {
  const raw = String(hint || "")
    .trim()
    .toLowerCase();
  if (
    raw === "admin" ||
    raw === "super_admin" ||
    raw === "super-admin" ||
    raw === "superadmin"
  ) {
    return LOGIN_HINTS.ADMIN;
  }
  if (raw === "agent") {
    return LOGIN_HINTS.AGENT;
  }
  return null;
}
