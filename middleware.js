import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const isAgentResetPasswordRoute = path === "/agent/reset-password";
    const isAdminResetPasswordRoute = path === "/admin/reset-password";
    const isResetPasswordRoute =
      isAgentResetPasswordRoute || isAdminResetPasswordRoute;

    if (token?.role === "agent" && token.isActive === false) {
      return NextResponse.redirect(new URL("/agent/login", req.url));
    }

    // Agents who haven't changed their temp password get sent to the
    // reset-password page no matter which admin page they try to open.
    if (token?.mustResetPassword && !isResetPasswordRoute) {
      return NextResponse.redirect(new URL("/agent/reset-password", req.url));
    }

    if (
      token?.role === "agent" &&
      path.startsWith("/admin") &&
      !isResetPasswordRoute
    ) {
      return NextResponse.redirect(new URL("/agent/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/admin/login",
    },
  },
);

// Protect everything under /admin/dashboard, /admin/properties, and the
// reset-password page itself (so it isn't reachable while logged out).
export const config = {
  matcher: [
    "/admin/dashboard/:path*",
    "/admin/properties/:path*",
    "/admin/reset-password",
    "/agent/reset-password",
    "/agent/dashboard/:path*",
    "/agent/properties/:path*",
  ],
};
