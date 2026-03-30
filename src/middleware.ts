import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import {
  getEnvConfig,
  getCurrentEnvironment,
  getSessionCookieName,
  isAllowedOrigin,
} from "@/lib/env-domains";

/**
 * Handle CORS preflight and add CORS headers
 */
function handleCors(req: NextRequest, response: NextResponse): NextResponse {
  const origin = req.headers.get("origin");

  if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";
  const path = url.pathname;

  // Handle CORS preflight requests for API routes
  if (path.startsWith("/api") && req.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return handleCors(req, response);
  }

  // Add CORS headers to API responses
  // Skip /api/auth as it handles its own CORS to ensure headers propagate correctly
  if (path.startsWith("/api") && !path.startsWith("/api/auth")) {
    const response = NextResponse.next();
    return handleCors(req, response);
  }

  // Bypass for static files
  if (path.startsWith("/_next") || path.includes(".")) {
    return NextResponse.next();
  }

  // Determine current environment for cookie name
  const cookieName = getSessionCookieName();

  // Get auth token for protected routes
  // Explicitly pass secret and cookie name to handle edge runtime properly
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: cookieName,
  });

  // 1. Domain Parsing - Environment Aware
  const config = getEnvConfig();
  const currentEnv = getCurrentEnvironment();
  const baseDomain = config.baseDomain.split(":")[0]; // Remove port if present
  const isLocal = currentEnv === "local";

  // For local environment, support both uplifterinc.localhost:3000 and localhost:3000
  const localRoot = config.baseDomain;
  let currentHost = hostname;

  // Parse subdomain from hostname
  if (isLocal) {
    // Local environment
    if (
      hostname === "localhost:3000" ||
      hostname === localRoot ||
      hostname === `www.${localRoot}`
    ) {
      currentHost = "main";
    } else if (hostname.endsWith(localRoot)) {
      // Handle admin.uplifterinc.localhost:3000 -> admin
      currentHost = hostname.replace(`.${localRoot}`, "");
    } else if (hostname.endsWith(".localhost:3000")) {
      // Handle admin.localhost:3000 -> admin (legacy fallback)
      currentHost = hostname.replace(".localhost:3000", "");
    } else {
      currentHost = "main";
    }
  } else {
    // Cloud environments (production, staging, development)
    if (hostname === baseDomain || hostname === `www.${baseDomain}`) {
      currentHost = "main";
    } else if (hostname.endsWith(`.${baseDomain}`)) {
      currentHost = hostname.replace(`.${baseDomain}`, "");
    } else {
      // Unknown domain - treat as main
      currentHost = "main";
    }
  }

  // Debug: log token retrieval for auth troubleshooting (only when AUTH_DEBUG is enabled)
  const sessionCookie = req.cookies.get(cookieName);
  if (process.env.AUTH_DEBUG === "true" && process.env.NODE_ENV === "production") {
    console.warn(
      "AUTH_DEBUG is enabled in production — ignoring to prevent sensitive data leakage"
    );
  } else if (process.env.AUTH_DEBUG === "true") {
    const allCookieNames = req.cookies.getAll().map((c) => c.name);
    if (
      currentHost === "admin" ||
      currentHost === "superadmin" ||
      currentHost === "pos" ||
      currentHost === "login" ||
      path.startsWith("/api/auth")
    ) {
      console.log(
        `Middleware: method=${req.method}, host=${currentHost}, path=${path}, env=${currentEnv}`
      );
      console.log(`Middleware: cookies=${JSON.stringify(allCookieNames)}`);
      console.log(
        `Middleware: looking for cookie=${cookieName}, found=${!!sessionCookie}, hasToken=${!!token}`
      );
      if (token) {
        console.log(`Middleware: tokenEmail=${token.email}`);
      }
    }
  }

  // Bypass rewriting for /api/auth routes to ensure they hit the global API handlers
  // This prevents them from being rewritten to /dashboard/api/auth/... on admin subdomain, etc.
  if (path.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Bypass all routing for webhook endpoints (external services POST directly, no auth)
  if (path.startsWith("/api/webhooks/")) {
    return NextResponse.next();
  }

  // 2. Portal Routing

  // Helper to get the login host based on environment
  const getLoginHost = () => `login.${config.baseDomain}`;

  // Helper to get a subdomain host
  const getSubdomainHost = (subdomain: string) => `${subdomain}.${config.baseDomain}`;

  // Get protocol based on environment
  const protocol = config.useHttps ? "https:" : "http:";

  // LOGIN PORTAL (login.{baseDomain}) -> /(auth)/*
  // In local dev, Google OAuth must go through localhost:3000 (Google's restriction)
  // The login form handles this by posting OAuth to localhost:3000, then session-bridge
  // transfers the session back to the local subdomains
  if (currentHost === "login") {
    // If user is already authenticated and visiting root or login page, redirect to the
    // appropriate portal based on their permissions:
    //   - Users with any admin/dashboard permissions → admin portal
    //   - Users with no permissions (e.g. PARENT role) → athletes portal
    if (token && (path === "/" || path === "/login")) {
      const permissions = token.permissions as string[] | undefined;
      const hasAdminAccess =
        token.isSuperAdmin || (Array.isArray(permissions) && permissions.length > 0);

      if (hasAdminAccess) {
        const adminHost = getSubdomainHost("admin");
        return NextResponse.redirect(`${protocol}//${adminHost}/`);
      } else {
        const athletesHost = getSubdomainHost("athletes");
        return NextResponse.redirect(`${protocol}//${athletesHost}/`);
      }
    }

    let newPath = path;
    if (path === "/") {
      newPath = "/login"; // Default to login page
    }
    // Routes like /login, /signup, /forgot-password are in the (auth) group
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // ADMIN PORTAL (admin.{baseDomain}) -> /dashboard
  if (currentHost === "admin") {
    // Redirect /login to centralized login portal
    if (path.startsWith("/login")) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      // Redirect to root of admin portal after login, or preserve callback
      const adminHost = getSubdomainHost("admin");
      const existingCallback = req.nextUrl.searchParams.get("callbackUrl");
      loginUrl.searchParams.set("callbackUrl", existingCallback || `${protocol}//${adminHost}/`);
      return NextResponse.redirect(loginUrl);
    }

    // Auth Check for Admin
    if (!token && !path.startsWith("/login")) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      // Construct the external callback URL (req.url gives internal Docker URL)
      const adminHost = getSubdomainHost("admin");
      const externalCallbackUrl = `${protocol}//${adminHost}${path}${url.search}`;
      loginUrl.searchParams.set("callbackUrl", externalCallbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    // Permission Check: users without admin permissions belong on the athletes portal
    if (token && !token.isSuperAdmin) {
      const permissions = token.permissions as string[] | undefined;
      const hasAdminAccess = Array.isArray(permissions) && permissions.length > 0;
      if (!hasAdminAccess && !path.startsWith("/switch-organization")) {
        const athletesHost = getSubdomainHost("athletes");
        return NextResponse.redirect(`${protocol}//${athletesHost}/`);
      }
    }

    // Organization Check - redirect to org selection if no org is set
    if (
      token &&
      !token.organizationId &&
      !path.startsWith("/switch-organization") &&
      !path.startsWith("/onboarding")
    ) {
      const adminHost = getSubdomainHost("admin");
      return NextResponse.redirect(`${protocol}//${adminHost}/switch-organization`);
    }

    // Redirects for moved pages (sidebar refactor)
    const adminRedirects: Record<string, string> = {
      "/settings/billing": "/usage/billing",
      "/settings/users": "/organization/users",
      "/communication/sms": "/usage/sms",
    };
    const redirectTarget = adminRedirects[path];
    if (redirectTarget) {
      const adminHost = getSubdomainHost("admin");
      return NextResponse.redirect(`${protocol}//${adminHost}${redirectTarget}`);
    }

    // /switch-organization resolves to the (auth) route group, not /dashboard
    if (path.startsWith("/switch-organization")) {
      return NextResponse.rewrite(url);
    }

    // Rewrite to /dashboard directory
    let newPath = path;
    if (path === "/") {
      newPath = "/dashboard";
    } else if (!path.startsWith("/dashboard")) {
      newPath = `/dashboard${path}`;
    }
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // SUPER ADMIN (superadmin.{baseDomain}) -> /superadmin
  if (currentHost === "superadmin") {
    // Redirect /login to centralized login portal
    if (path.startsWith("/login")) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      const superAdminHost = getSubdomainHost("superadmin");
      const existingCallback = req.nextUrl.searchParams.get("callbackUrl");
      loginUrl.searchParams.set(
        "callbackUrl",
        existingCallback || `${protocol}//${superAdminHost}/`
      );
      return NextResponse.redirect(loginUrl);
    }

    if (!token?.isSuperAdmin && !path.startsWith("/login")) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      // Construct the external callback URL (req.url gives internal Docker URL)
      const superAdminHost = getSubdomainHost("superadmin");
      const externalCallbackUrl = `${protocol}//${superAdminHost}${path}${url.search}`;
      loginUrl.searchParams.set("callbackUrl", externalCallbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    let newPath = path;
    if (path === "/") {
      newPath = "/superadmin";
    } else if (!path.startsWith("/superadmin")) {
      newPath = `/superadmin${path}`;
    }
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // COACH PORTAL (coach.{baseDomain}) -> /coach
  if (currentHost === "coach") {
    let newPath = path;
    if (path === "/") {
      newPath = "/coach";
    } else if (!path.startsWith("/coach")) {
      newPath = `/coach${path}`;
    }
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // ATHLETE PORTAL (athletes.{baseDomain}) -> /athletes
  if (currentHost === "athletes") {
    // Redirect /login to centralized login portal
    if (path.startsWith("/login")) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      const athletesHost = getSubdomainHost("athletes");
      const existingCallback = req.nextUrl.searchParams.get("callbackUrl");
      loginUrl.searchParams.set("callbackUrl", existingCallback || `${protocol}//${athletesHost}/`);
      return NextResponse.redirect(loginUrl);
    }

    // Auth Check for Athletes Portal
    if (!token && !path.startsWith("/login")) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      const athletesHost = getSubdomainHost("athletes");
      const externalCallbackUrl = `${protocol}//${athletesHost}${path}${url.search}`;
      loginUrl.searchParams.set("callbackUrl", externalCallbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    let newPath = path;
    if (path === "/") {
      newPath = "/athletes";
    } else if (!path.startsWith("/athletes")) {
      newPath = `/athletes${path}`;
    }
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // POS PORTAL (pos.{baseDomain}) -> /pos
  if (currentHost === "pos") {
    // Redirect /login to centralized login portal
    if (path.startsWith("/login")) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      const posHost = getSubdomainHost("pos");

      // Preserve existing callback or set default, including orgId param if present
      const existingCallback = req.nextUrl.searchParams.get("callbackUrl");
      const orgId = req.nextUrl.searchParams.get("orgId");

      let callbackUrl = existingCallback || `${protocol}//${posHost}/`;
      if (orgId && !existingCallback) {
        callbackUrl = `${protocol}//${posHost}/?orgId=${encodeURIComponent(orgId)}`;
      }

      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    // Auth Check for POS - redirect unauthenticated users to login
    if (!token && !path.startsWith("/login")) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);

      // Construct the external callback URL (req.url gives internal Docker URL)
      const posHost = getSubdomainHost("pos");
      const externalCallbackUrl = `${protocol}//${posHost}${path}${url.search}`;

      loginUrl.searchParams.set("callbackUrl", externalCallbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    let newPath = path;
    if (path === "/") {
      newPath = "/pos";
    } else if (!path.startsWith("/pos")) {
      newPath = `/pos${path}`;
    }
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // FEEDBACK PORTAL (feedback.{baseDomain}) -> /feedback
  if (currentHost === "feedback") {
    let newPath = path;
    if (path === "/") {
      newPath = "/feedback";
    } else if (!path.startsWith("/feedback")) {
      newPath = `/feedback${path}`;
    }
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // EVENTS PORTAL (events.{baseDomain}) -> /events
  if (currentHost === "events") {
    let newPath = path;
    if (path === "/") {
      newPath = "/events";
    } else if (!path.startsWith("/events")) {
      newPath = `/events${path}`;
    }
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // STARTUP PORTAL (startup.{baseDomain}) -> /org-signup
  // No auth required - public organization registration page
  // Supports URL parameters for pre-filling form data (e.g., ?plan=pro&ref=partner123)
  if (currentHost === "startup") {
    let newPath = path;
    if (path === "/") {
      newPath = "/org-signup";
    } else if (!path.startsWith("/org-signup")) {
      newPath = `/org-signup${path}`;
    }
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // TENANT SITES (wildcard)
  if (currentHost !== "main" && currentHost !== "www") {
    // Redirect /login to centralized login portal with callback back to this site
    if (path.startsWith("/login")) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      const existingCallback = req.nextUrl.searchParams.get("callbackUrl");
      loginUrl.searchParams.set("callbackUrl", existingCallback || `${protocol}//${hostname}/`);
      return NextResponse.redirect(loginUrl);
    }

    url.pathname = `/sites/${currentHost}${path}`;
    return NextResponse.rewrite(url);
  }

  // 3. Main Domain Handling
  if (currentHost === "main" || currentHost === "www") {
    // Redirect /dashboard to admin subdomain
    if (path.startsWith("/dashboard")) {
      const adminHost = getSubdomainHost("admin");
      const newPath = path.replace("/dashboard", "") || "/";
      return NextResponse.redirect(`${protocol}//${adminHost}${newPath}`);
    }

    // Redirect all auth routes to the login subdomain
    // This ensures login only happens through the centralized login portal
    const authPaths = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];
    if (authPaths.some((authPath) => path === authPath || path.startsWith(authPath + "/"))) {
      const loginHost = getLoginHost();
      const loginUrl = new URL(path, `${protocol}//${loginHost}`);
      // Preserve query parameters (like callbackUrl)
      req.nextUrl.searchParams.forEach((value, key) => {
        loginUrl.searchParams.set(key, value);
      });
      return NextResponse.redirect(loginUrl);
    }

    // Redirect unauthenticated users from root to login subdomain
    if (path === "/" && !token) {
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)"],
};
