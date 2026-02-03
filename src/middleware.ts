import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/**
 * Environment Configuration
 * 
 * Note: We inline the config here instead of importing from @/lib/env-domains
 * because middleware runs in the Edge runtime and has limited module support.
 */
type Environment = 'production' | 'staging' | 'development' | 'local';

interface EnvironmentConfig {
  baseDomain: string;
  useHttps: boolean;
}

const ENV_CONFIG: Record<Environment, EnvironmentConfig> = {
  production: {
    baseDomain: 'uplifterinc.com',
    useHttps: true,
  },
  staging: {
    baseDomain: 'upliftergymnastics.com',
    useHttps: true,
  },
  development: {
    baseDomain: 'uplifterdev.com',
    useHttps: true,
  },
  local: {
    baseDomain: 'uplifterinc.localhost:3000',
    useHttps: false,
  },
};

function getCurrentEnvironment(): Environment {
  const env = process.env.APP_ENVIRONMENT;
  if (env && env in ENV_CONFIG) {
    return env as Environment;
  }
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  return 'local';
}

function getEnvConfig(): EnvironmentConfig {
  return ENV_CONFIG[getCurrentEnvironment()];
}

/**
 * Allowed origins for CORS
 * Based on the current environment configuration
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  const config = getEnvConfig();
  const currentEnv = getCurrentEnvironment();
  const baseDomain = config.baseDomain.split(':')[0]; // Remove port if present
  
  // Local environment allows localhost variations
  if (currentEnv === 'local') {
    if (origin.includes("localhost")) return true;
    if (origin.includes("uplifterinc.localhost")) return true;
  }
  
  // Check against the current environment's domain
  const protocol = config.useHttps ? 'https' : 'http';
  if (origin === `${protocol}://${baseDomain}` || 
      origin === `${protocol}://www.${baseDomain}`) {
    return true;
  }
  
  // Check subdomains
  if (origin.endsWith(`.${baseDomain}`)) {
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

  // 1. Domain Parsing - Environment Aware
  const config = getEnvConfig();
  const currentEnv = getCurrentEnvironment();
  const baseDomain = config.baseDomain.split(':')[0]; // Remove port if present
  const isLocal = currentEnv === 'local';
  
  // For local environment, support both uplifterinc.localhost:3000 and localhost:3000
  const localRoot = config.baseDomain;
  let currentHost = hostname;

  // Parse subdomain from hostname
  if (isLocal) {
    // Local environment
    if (hostname === "localhost:3000" || hostname === localRoot || hostname === `www.${localRoot}`) {
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

  // Debug: log token retrieval for auth troubleshooting
  const sessionCookie = req.cookies.get("next-auth.session-token");
  if (currentHost === "admin" || currentHost === "superadmin" || currentHost === "pos") {
    console.log(`Middleware: host=${currentHost}, path=${path}, hasCookie=${!!sessionCookie}, hasToken=${!!token}`);
  }

  // 2. Portal Routing
  
  // LOGIN PORTAL (login.{baseDomain}) -> /(auth)/*
  // In local dev, Google OAuth must go through localhost:3000 (Google's restriction)
  // The login form handles this by posting OAuth to localhost:3000, then session-bridge
  // transfers the session back to the local subdomains
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
  const getLoginHost = () => `login.${config.baseDomain}`;
  
  // Helper to get a subdomain host
  const getSubdomainHost = (subdomain: string) => `${subdomain}.${config.baseDomain}`;
  
  // Get protocol based on environment
  const protocol = config.useHttps ? 'https:' : 'http:';

  // ADMIN PORTAL (admin.{baseDomain}) -> /dashboard
  if (currentHost === "admin") {
    // Debug logging for auth issues
    console.log(`Middleware [admin]: path=${path}, hasToken=${!!token}, tokenEmail=${token?.email || 'none'}`);
    
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
      console.log(`Middleware [admin]: No token found, redirecting to login`);
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

  // SUPER ADMIN (superadmin.{baseDomain}) -> /superadmin
  if (currentHost === "superadmin") {
      // Redirect /login to centralized login portal
      if (path.startsWith("/login")) {
         const loginHost = getLoginHost();
         const loginUrl = new URL("/login", `${protocol}//${loginHost}`);
         const superAdminHost = getSubdomainHost("superadmin");
         const existingCallback = req.nextUrl.searchParams.get("callbackUrl");
         loginUrl.searchParams.set("callbackUrl", existingCallback || `${protocol}//${superAdminHost}/`);
         return NextResponse.redirect(loginUrl);
      }

      if (!token?.isSuperAdmin && !path.startsWith("/login")) {
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
      if (authPaths.some(authPath => path === authPath || path.startsWith(authPath + "/"))) {
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)",
  ],
};
