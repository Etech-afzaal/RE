/**
 * Phase 2 — canonical roles for Dhalahore.
 *
 * The administrator role is stored in JWT/session as superadmin.
 * The existing agent role representation remains unchanged.
 */

export const ROLES = {
  SUPERADMIN: "superadmin",
  AGENT: "AGENT",
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
  if (value === "SUPERADMIN") {
    return ROLES.SUPERADMIN;
  }
  if (value === "AGENT") {
    return ROLES.AGENT;
  }
  return value;
}

export function isSuperAdmin(role) {
  return normalizeRole(role) === ROLES.SUPERADMIN;
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
  return raw === ROLES.SUPERADMIN || raw === "agent" ? raw : null;
}
