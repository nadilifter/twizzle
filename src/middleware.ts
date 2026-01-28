import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/**
 * Allowed origins for CORS
 * In production, only uplifterinc.com and its subdomains are allowed
 * In development, localhost variations are also allowed
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Development origins
  if (process.env.NODE_ENV === "development") {
    if (origin.includes("localhost")) return true;
    if (origin.includes("uplifterinc.localhost")) return true;
  }
  
  // Production origins - uplifterinc.com and all subdomains
  if (origin.endsWith(".uplifterinc.com") || origin === "https://uplifterinc.com") {
    return true;
  }
  
  return false;
}

/**
 * Handle CORS preflight and add CORS headers
 */
function handleCors(req: NextRequest, response: NextResponse): NextResponse {
  const origin = req.headers.get("origin");
  
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
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
  if (path.startsWith("/api")) {
    const response = NextResponse.next();
    return handleCors(req, response);
  }

  // Bypass for static files
  if (path.startsWith("/_next") || path.includes(".")) {
    return NextResponse.next();
  }

  // Get auth token for protected routes
  const token = await getToken({ req });

  // 1. Domain Parsing
  const isLocal = hostname.includes("localhost");
  // We allow both uplifterinc.localhost:3000 (preferred) and localhost:3000 (legacy)
  const localRoot = "uplifterinc.localhost:3000"; 
  let currentHost = hostname;

  if (isLocal) {
    if (hostname === "localhost:3000" || hostname === localRoot) {
      currentHost = "main";
    } else {
      // Handle admin.uplifterinc.localhost:3000 -> admin
      if (hostname.endsWith(localRoot)) {
          currentHost = hostname.replace(`.${localRoot}`, "");
      } else {
          // Handle admin.localhost:3000 -> admin (fallback)
          currentHost = hostname.replace(`.localhost:3000`, "");
      }
    }
  } else {
    if (hostname === "uplifterinc.com" || hostname === "www.uplifterinc.com") {
      currentHost = "main";
    } else {
      currentHost = hostname.replace(`.uplifterinc.com`, "");
    }
  }

  // 2. Portal Routing
  
  // LOGIN PORTAL (login.uplifterinc.com) -> /(auth)/*
  // In local dev, Google OAuth must go through localhost:3000 (Google's restriction)
  // The login form handles this by posting OAuth to localhost:3000, then session-bridge
  // transfers the session back to uplifterinc.localhost subdomains
  if (currentHost === "login") {
    let newPath = path;
    if (path === "/") {
      newPath = "/login"; // Default to login page
    }
    // Routes like /login, /signup, /forgot-password are in the (auth) group
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // Helper to get the login host based on environment
  const getLoginHost = () => isLocal ? "login.uplifterinc.localhost:3000" : "login.uplifterinc.com";

  // ADMIN PORTAL (admin.uplifterinc.com) -> /dashboard
  if (currentHost === "admin") {
    // Redirect /login to centralized login portal
    if (path.startsWith("/login")) {
         const protocol = req.nextUrl.protocol;
         const loginHost = getLoginHost();
         const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
         // Redirect to root of admin portal after login, or preserve callback
         const adminHost = isLocal ? `admin.${localRoot}` : "admin.uplifterinc.com";
         const existingCallback = req.nextUrl.searchParams.get("callbackUrl");
         loginUrl.searchParams.set("callbackUrl", existingCallback || `${protocol}//${adminHost}/`);
         return NextResponse.redirect(loginUrl);
    }

    // Auth Check for Admin
    if (!token && !path.startsWith("/login")) {
      const protocol = req.nextUrl.protocol;
      const loginHost = getLoginHost();
      const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Organization Check
    if (
      token && 
      !token.organizationId && 
      !path.startsWith("/switch-organization") && 
      !path.startsWith("/onboarding")
    ) {
        // Allow pass-through to dashboard logic
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

  // SUPER ADMIN (superadmin.uplifterinc.com) -> /superadmin
  if (currentHost === "superadmin") {
      // Redirect /login to centralized login portal
      if (path.startsWith("/login")) {
         const protocol = req.nextUrl.protocol;
         const loginHost = getLoginHost();
         const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
         const superAdminHost = isLocal ? `superadmin.${localRoot}` : "superadmin.uplifterinc.com";
         const existingCallback = req.nextUrl.searchParams.get("callbackUrl");
         loginUrl.searchParams.set("callbackUrl", existingCallback || `${protocol}//${superAdminHost}/`);
         return NextResponse.redirect(loginUrl);
      }

      if (!token?.isSuperAdmin && !path.startsWith("/login")) {
         const protocol = req.nextUrl.protocol;
         const loginHost = getLoginHost();
         const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
         loginUrl.searchParams.set("callbackUrl", req.url);
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

  // COACH PORTAL (coach.uplifterinc.com) -> /coach
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

  // ATHLETE PORTAL (athletes.uplifterinc.com) -> /athletes
  if (currentHost === "athletes") {
      let newPath = path;
      if (path === "/") {
          newPath = "/athletes";
      } else if (!path.startsWith("/athletes")) {
          newPath = `/athletes${path}`;
      }
      url.pathname = newPath;
      return NextResponse.rewrite(url);
  }

  // POS PORTAL (pos.uplifterinc.com) -> /pos
  if (currentHost === "pos") {
      // Redirect /login to centralized login portal
      if (path.startsWith("/login")) {
          const protocol = req.nextUrl.protocol;
          const loginHost = getLoginHost();
          const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
          const posHost = isLocal ? `pos.${localRoot}` : "pos.uplifterinc.com";
          
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
          const protocol = req.nextUrl.protocol;
          const loginHost = getLoginHost();
          const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
          
          // Preserve orgId in callback URL if present
          const callbackUrl = req.url;
          
          loginUrl.searchParams.set("callbackUrl", callbackUrl);
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

  // FEEDBACK PORTAL (feedback.uplifterinc.com) -> /feedback
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

  // EVENTS PORTAL (events.uplifterinc.com) -> /events
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

  // SIGNUP PORTAL (signup.uplifterinc.com) -> /org-signup
  // No auth required - public organization registration page
  if (currentHost === "signup") {
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
      url.pathname = `/sites/${currentHost}${path}`;
      return NextResponse.rewrite(url);
  }

  // 3. Main Domain Handling
  if (currentHost === "main" || currentHost === "www") {
      // Redirect /dashboard to admin subdomain
      if (path.startsWith("/dashboard")) {
         const protocol = req.nextUrl.protocol;
         const adminHost = isLocal ? `admin.${localRoot}` : "admin.uplifterinc.com";
         const newPath = path.replace("/dashboard", "") || "/";
         return NextResponse.redirect(`${protocol}//${adminHost}${newPath}`);
      }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)",
  ],
};
