import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";
  const path = url.pathname;

  // 1. Handle Subdomains (Public Sites)
  // Determine if we are on localhost or production
  const isLocal = hostname.includes("localhost");
  const rootDomain = isLocal ? "localhost:3000" : "uplifterinc.com";

  // Check if we are on a subdomain
  let currentHost = hostname;
  
  if (isLocal) {
    // If hostname is exactly localhost:3000, it's main
    if (hostname === "localhost:3000") {
      currentHost = "main";
    } else {
      // Otherwise, extract subdomain: foo.localhost:3000 -> foo
      currentHost = hostname.replace(`.${rootDomain}`, "");
    }
  } else {
    // Production logic
    if (hostname === "uplifterinc.com" || hostname === "www.uplifterinc.com") {
      currentHost = "main";
    } else {
      // Assume subdomain is the first part
      currentHost = hostname.replace(`.uplifterinc.com`, "");
    }
  }

  // If it's a subdomain (not main) and not an API route/Next internal
  if (
    currentHost !== "main" && 
    currentHost !== "www" && 
    !path.startsWith("/api") && 
    !path.startsWith("/_next")
  ) {
    // Rewrite to /sites/[subdomain]
    // Preserve query parameters
    url.pathname = `/sites/${currentHost}${path}`;
    return NextResponse.rewrite(url);
  }

  // 2. Handle Auth for Main Domain
  
  // Public paths that don't require authentication on the main domain
  const publicPaths = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/api/auth",
  ];

  const isPublicPath = publicPaths.some((p) => path.startsWith(p));

  // If we are on main domain
  if (currentHost === "main" || currentHost === "www") {
    // Root path handling
    if (path === "/") {
      if (token) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      } else {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // Protected routes (Dashboard)
    if (!token && path.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    
    // Onboarding/Organization Selection check
    if (
      token && 
      !token.organizationId && 
      !path.startsWith("/switch-organization") && 
      !path.startsWith("/onboarding") &&
      !path.startsWith("/api") &&
      !path.startsWith("/_next") &&
      !isPublicPath
    ) {
      return NextResponse.redirect(new URL("/switch-organization", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions: png, jpg, jpeg, svg, gif, webp
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)",
  ],
};
