import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isAgentRole, isSuperAdmin } from "@/lib/roles";

/**
 * Phase 2 route protection.
 *
 * Existing routes (preserved):
 *   superadmin → /admin/dashboard/*
 *   AGENT       → /agent/dashboard, /agent/properties/*, /agent/reset-password
 *
 * Estate agent portal:
 *   AGENT       → /re/[username]/dashboard/*
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
    const estateDashboardMatch = path.match(
      /^\/re\/([^/]+)\/dashboard(?:\/|$)/,
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
            ? `/re/${encodeURIComponent(handle)}/dashboard`
            : "/agent/dashboard",
          req.url,
        ),
      );
    }

    // Admin dashboard: superadmin only.
    if (isAdminArea && !isAdmin) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    // Existing agent routes: AGENT only.
    if (isAgentPortal && !isAgent) {
      return NextResponse.redirect(new URL("/agent/login", req.url));
    }

    // Per-estate agent dashboard: AGENT only, and username must match token.
    if (estateDashboardMatch) {
      if (!isAgent) {
        return NextResponse.redirect(new URL("/agent/login", req.url));
      }
      const pathUsername = decodeURIComponent(estateDashboardMatch[1]).toLowerCase();
      const tokenUsername = String(
        token.username || token.estate_name || "",
      ).toLowerCase();
      if (tokenUsername && pathUsername !== tokenUsername) {
        const handle = token.username || token.estate_name;
        return NextResponse.redirect(
          new URL(
            handle
              ? `/re/${encodeURIComponent(handle)}/dashboard`
              : "/agent/dashboard",
            req.url,
          ),
        );
      }
    }

    // Superadmins should not use agent-only tools.
    if (isAdmin && (isAgentPortal || estateDashboardMatch)) {
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
    // Existing superadmin surfaces
    "/admin/dashboard",
    "/admin/dashboard/:path*",
    // Future superadmin alias (not implemented as pages yet)
    "/admin_dashboard",
    "/admin_dashboard/:path*",
    // Existing AGENT surfaces
    "/agent/reset-password",
    "/agent/dashboard",
    "/agent/dashboard/:path*",
    "/agent/properties",
    "/agent/properties/:path*",
    // Per-estate AGENT dashboard
    "/re/:username/dashboard",
    "/re/:username/dashboard/:path*",
  ],
};
