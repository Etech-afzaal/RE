import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAgentRole, isSuperAdmin, ROLES } from "@/lib/roles";

function unauthorized(message = "Unauthorized", status = 401) {
  return Response.json({ error: message }, { status });
}

/**
 * Current NextAuth session (server-side). Never trust client-provided roles.
 * @returns {Promise<import("next-auth").Session|null>}
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

/**
 * Require a superadmin session.
 * Used by admin dashboard APIs.
 */
export async function requireAdmin() {
  const session = await getCurrentUser();
  if (!session || !isSuperAdmin(session.user.role)) {
    return {
      session: null,
      error: unauthorized("Unauthorized"),
    };
  }
  return { session, error: null };
}

/**
 * Require AGENT with an approved (live) account.
 * Future property/profile APIs should use this instead of ad-hoc role strings.
 */
export async function requireAgent() {
  const session = await getCurrentUser();
  if (!session || !isAgentRole(session.user.role)) {
    return {
      session: null,
      user: null,
      error: unauthorized("Unauthorized"),
    };
  }

  if (session.user.isActive === false) {
    return {
      session: null,
      user: null,
      error: unauthorized("Agent account is not active.", 403),
    };
  }

  return {
    session,
    user: session.user,
    error: null,
  };
}

/**
 * Require a specific canonical role (server-side only).
 * @param {typeof ROLES[keyof typeof ROLES]} role
 */
export async function requireRole(role) {
  const session = await getCurrentUser();
  if (!session) {
    return { session: null, error: unauthorized("Unauthorized") };
  }

  if (role === ROLES.SUPERADMIN && !isSuperAdmin(session.user.role)) {
    return { session: null, error: unauthorized("Forbidden", 403) };
  }
  if (role === ROLES.AGENT && !isAgentRole(session.user.role)) {
    return { session: null, error: unauthorized("Forbidden", 403) };
  }

  return { session, error: null };
}
