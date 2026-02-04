import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isAllowedOrigin } from "@/lib/env-domains";

const nextAuthHandler = NextAuth(authOptions);

/**
 * Add CORS headers to response for cross-origin requests
 * This is critical for local development where login.uplifterinc.localhost:3000
 * needs to fetch CSRF tokens from localhost:3000 for Google OAuth
 */
function addCorsHeaders(request: NextRequest, response: Response): Response {
  const origin = request.headers.get("origin");
  
  if (origin && isAllowedOrigin(origin)) {
    // Clone the response to add headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", origin);
    newHeaders.set("Access-Control-Allow-Credentials", "true");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    // Explicitly copy Set-Cookie to avoid it being dropped during cloning
    // Note: Headers.get() might merge multiple Set-Cookie headers, but for Auth 
    // we usually care about the session cookie.
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie) {
      // If newHeaders lost it (some environments), put it back
      if (!newHeaders.has("Set-Cookie")) {
         newHeaders.set("Set-Cookie", setCookie);
      }
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
  
  return response;
}

/**
 * Handle CORS preflight requests
 */
function handlePreflight(request: NextRequest): NextResponse | null {
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    
    if (origin && isAllowedOrigin(origin)) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
  }
  
  return null;
}

/**
 * GET handler - Used for CSRF token, session, etc.
 * These don't need strict rate limiting as they're not login attempts.
 * 
 * CORS headers are explicitly added here because middleware's NextResponse.next()
 * headers don't reliably propagate through to the NextAuth response.
 */
export async function GET(request: NextRequest, context: { params: { nextauth: string[] } }) {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;
  
  const response = await nextAuthHandler(request, context);
  return addCorsHeaders(request, response);
}

/**
 * OPTIONS handler - Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;
  
  // If origin not allowed, return 204 without CORS headers
  return new NextResponse(null, { status: 204 });
}

/**
 * POST handler - Used for credential login, signout, etc.
 * Apply rate limiting to prevent brute force attacks.
 */
// ... imports

// Helper to log response details
function logResponse(action: string, response: Response) {
  const setCookie = response.headers.get("Set-Cookie");
  const allowOrigin = response.headers.get("Access-Control-Allow-Origin");
  const cookieNames = setCookie ? setCookie.split(',').map(c => c.split('=')[0]).join(', ') : 'none';
  
  console.log(`Auth API [${action}]: Status=${response.status}`);
  console.log(`Auth API [${action}]: Set-Cookie names=${cookieNames}`);
  if (setCookie) console.log(`Auth API [${action}]: Set-Cookie full=${setCookie.substring(0, 100)}...`); // Log start of cookie for debugging attributes
  console.log(`Auth API [${action}]: Access-Control-Allow-Origin=${allowOrigin}`);
}

export async function POST(request: NextRequest, context: { params: { nextauth: string[] } }) {
  const action = context.params.nextauth?.[0];
  console.log(`Auth API [POST]: action=${action}, origin=${request.headers.get("origin")}`);
  
  // Handle _log action to prevent 404s from NextAuth client logger
  if (action === "_log") {
    return new NextResponse(null, { status: 200 });
  }
  
  // Apply strict rate limiting for credential sign-in attempts
  if (action === "callback" || action === "signin") {
    const rateLimitResponse = await checkAuthRateLimit(request, RATE_LIMITS.auth);
    if (rateLimitResponse) {
      return addCorsHeaders(request, rateLimitResponse);
    }
  }

  const response = await nextAuthHandler(request, context);
  
  // Debug: Log headers from NextAuth response before processing
  const rawSetCookie = response.headers.get("Set-Cookie");
  console.log(`Auth API [POST]: Raw NextAuth Set-Cookie present=${!!rawSetCookie}`);
  if (rawSetCookie) {
    console.log(`Auth API [POST]: Raw NextAuth Set-Cookie length=${rawSetCookie.length}`);
  }

  const finalResponse = addCorsHeaders(request, response);
  logResponse(`POST ${action}`, finalResponse);
  return finalResponse;
}
