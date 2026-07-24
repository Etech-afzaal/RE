import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const isAgentResetPasswordRoute = path === "/agent/reset-password";

    if (token?.role === "agent" && token.isActive === false) {
      return NextResponse.redirect(new URL("/agent/login", req.url));
    }

    // Agents who haven't changed their temp password get sent to the
    // reset-password page no matter which protected page they try to open.
    if (token?.mustResetPassword && !isAgentResetPasswordRoute) {
      return NextResponse.redirect(new URL("/agent/reset-password", req.url));
    }

    if (token?.role === "agent" && path.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/agent/dashboard", req.url));
    }

    if (path.startsWith("/admin/dashboard") && token?.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/admin/login",
    },
  },
);

export const config = {
  matcher: [
    "/admin/dashboard",
    "/admin/dashboard/:path*",
    "/agent/reset-password",
    "/agent/dashboard/:path*",
    "/agent/properties/:path*",
  ],
};
