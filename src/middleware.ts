import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Handle root path redirects
    if (path === "/") {
      if (token) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      } else {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // If no token and trying to access protected routes, redirect to login
    if (!token && path.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // If authenticated but no organization selected
    // And not already on the switch page or onboarding
    // And not an API route
    if (
        token && 
        !token.organizationId && 
        !path.startsWith("/switch-organization") && 
        !path.startsWith("/onboarding") &&
        !path.startsWith("/api") &&
        !path.startsWith("/_next")
    ) {
        return NextResponse.redirect(new URL("/switch-organization", req.url));
    }

    // Allow access if authenticated
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Public routes that don't require authentication
        const publicPaths = [
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/api/auth",
        ];

        // Check if current path is public
        const isPublicPath = publicPaths.some((p) => path.startsWith(p));
        if (isPublicPath) return true;

        // For protected routes, require a token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    // Match all paths except static files and API routes (except auth)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
