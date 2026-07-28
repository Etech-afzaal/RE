import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isAgentRole, isSuperAdmin } from "@/lib/roles";

/**
 * Phase 2 route protection.
 *
 * Existing routes (preserved):
 *   SUPER_ADMIN → /admin/dashboard/*
 *   AGENT       → /agent/dashboard, /agent/properties/*, /agent/reset-password
 *
 * Future patterns (matcher ready; pages not built in this phase):
 *   SUPER_ADMIN → /admin_dashboard/*
 *   AGENT       → /re/[username]/adminarea/*
 *
 * Public (no middleware): /, /re/[slug], /re/[slug]/[id], login/signup pages
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const role = token?.role;
    const isAgent = isAgentRole(role);
    const isAdmin = isSuperAdmin(role);

    const isAgentResetPasswordRoute = path === "/agent/reset-password";
    const isAdminArea =
      path.startsWith("/admin/dashboard") ||
      path.startsWith("/admin_dashboard");
    const isAgentPortal =
      path.startsWith("/agent/dashboard") ||
      path.startsWith("/agent/properties") ||
      isAgentResetPasswordRoute;
    const adminAreaMatch = path.match(
      /^\/re\/([^/]+)\/adminarea(?:\/|$)/,
    );

    // Agents that are not approved (or lost approval mid-session) → login.
    if (isAgent && token.isActive === false) {
      return NextResponse.redirect(new URL("/agent/login", req.url));
    }

    // Temp password must be changed before using agent tools.
    if (isAgent && token.mustResetPassword && !isAgentResetPasswordRoute) {
      return NextResponse.redirect(new URL("/agent/reset-password", req.url));
    }

    // Agents never access admin surfaces.
    if (isAgent && isAdminArea) {
      const handle = token.username || token.estate_name;
      return NextResponse.redirect(
        new URL(
          handle
            ? `/re/${encodeURIComponent(handle)}/adminarea`
            : "/agent/dashboard",
          req.url,
        ),
      );
    }

    // Admin dashboard: SUPER_ADMIN only (legacy "admin" normalized in JWT).
    if (isAdminArea && !isAdmin) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    // Existing agent routes: AGENT only.
    if (isAgentPortal && !isAgent) {
      return NextResponse.redirect(new URL("/agent/login", req.url));
    }

    // Future per-estate admin area: AGENT only, and username must match token.
    if (adminAreaMatch) {
      if (!isAgent) {
        return NextResponse.redirect(new URL("/agent/login", req.url));
      }
      const pathUsername = decodeURIComponent(adminAreaMatch[1]).toLowerCase();
      const tokenUsername = String(
        token.username || token.estate_name || "",
      ).toLowerCase();
      if (tokenUsername && pathUsername !== tokenUsername) {
        const handle = token.username || token.estate_name;
        return NextResponse.redirect(
          new URL(
            handle
              ? `/re/${encodeURIComponent(handle)}/adminarea`
              : "/agent/dashboard",
            req.url,
          ),
        );
      }
    }

    // SUPER_ADMIN should not use agent-only tools.
    if (isAdmin && (isAgentPortal || adminAreaMatch)) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/admin/login",
    },
    callbacks: {
      // withAuth already requires a token for matched routes; keep explicit.
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: [
    // Existing SUPER_ADMIN surfaces
    "/admin/dashboard",
    "/admin/dashboard/:path*",
    // Future SUPER_ADMIN alias (not implemented as pages yet)
    "/admin_dashboard",
    "/admin_dashboard/:path*",
    // Existing AGENT surfaces
    "/agent/reset-password",
    "/agent/dashboard",
    "/agent/dashboard/:path*",
    "/agent/properties",
    "/agent/properties/:path*",
    // Future AGENT estate admin area (not implemented as pages yet)
    "/re/:username/adminarea",
    "/re/:username/adminarea/:path*",
  ],
};
