import { redis, isRedisAvailable } from "./redis";

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Number of remaining requests in the window */
  remaining: number;
  /** Unix timestamp when the rate limit resets */
  reset: number;
  /** Total limit for the window */
  limit: number;
}

/**
 * Default rate limit configurations for different endpoints
 * More lenient in development to avoid hitting limits during testing
 */
const isDev = process.env.NODE_ENV === "development";

export const RATE_LIMITS = {
  /** Auth endpoints (login, signup) - prevent brute force */
  auth: { limit: isDev ? 100 : 30, windowSeconds: 60 },
  /** Password reset */
  passwordReset: { limit: isDev ? 30 : 10, windowSeconds: 300 },
  /** API endpoints - burst protection */
  api: { limit: isDev ? 50 : 20, windowSeconds: 1 },
  /** Sensitive operations (payment, etc) */
  sensitive: { limit: isDev ? 15 : 5, windowSeconds: 1 },
  /** MFA challenge requests */
  mfaChallenge: { limit: isDev ? 50 : 20, windowSeconds: 300 },
  /** Email login code requests */
  emailLoginSend: { limit: isDev ? 30 : 10, windowSeconds: 300 },
  /** Medical/PHI endpoints - covers multi-athlete multi-step flows */
  medical: { limit: isDev ? 100 : 45, windowSeconds: 60 },
} as const;

/**
 * Check rate limit for a given identifier using sliding window algorithm
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param prefix - Key prefix to namespace rate limits (e.g., "auth", "api")
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  prefix: string,
  config: RateLimitConfig,
  { failClosed = false }: { failClosed?: boolean } = {}
): Promise<RateLimitResult> {
  if (!isRedisAvailable() || !redis) {
    if (failClosed && !isDev) {
      console.warn(
        "Rate limiting: Redis unavailable, failing closed for security-critical endpoint"
      );
      return {
        success: false,
        remaining: 0,
        reset: Date.now() + config.windowSeconds * 1000,
        limit: config.limit,
      };
    }
    console.warn("Rate limiting disabled: Redis not configured");
    return {
      success: true,
      remaining: config.limit,
      reset: Date.now() + config.windowSeconds * 1000,
      limit: config.limit,
    };
  }

  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;
  const key = `ratelimit:${prefix}:${identifier}`;

  try {
    // Use a sorted set with timestamps as scores for sliding window
    // Remove old entries, add current request, and count
    const pipeline = redis.pipeline();

    // Remove entries older than the window
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Add current request with timestamp as score
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });

    // Count requests in window
    pipeline.zcard(key);

    // Set expiry on the key
    pipeline.expire(key, config.windowSeconds);

    const results = await pipeline.exec();

    // zcard result is at index 2
    const requestCount = (results[2] as number) || 0;
    const remaining = Math.max(0, config.limit - requestCount);
    const reset = now + config.windowSeconds * 1000;

    if (requestCount > config.limit) {
      return {
        success: false,
        remaining: 0,
        reset,
        limit: config.limit,
      };
    }

    return {
      success: true,
      remaining,
      reset,
      limit: config.limit,
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    if (failClosed) {
      return {
        success: false,
        remaining: 0,
        reset: Date.now() + config.windowSeconds * 1000,
        limit: config.limit,
      };
    }
    return {
      success: true,
      remaining: config.limit,
      reset: Date.now() + config.windowSeconds * 1000,
      limit: config.limit,
    };
  }
}

/**
 * Get client IP from request headers
 * Handles common proxy headers (X-Forwarded-For, X-Real-IP, etc.)
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback - in serverless environments this might not be available
  return "unknown";
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}

/**
 * Helper to check auth rate limit and return response if exceeded
 *
 * @param request - The incoming request
 * @param customConfig - Optional custom rate limit config
 * @returns null if allowed, Response if rate limited
 */
export async function checkAuthRateLimit(
  request: Request,
  customConfig?: RateLimitConfig
): Promise<Response | null> {
  const ip = getClientIp(request);
  const config = customConfig || RATE_LIMITS.auth;
  const result = await checkRateLimit(ip, "auth", config, { failClosed: true });

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
          ...rateLimitHeaders(result),
        },
      }
    );
  }

  return null;
}

/**
 * Helper to check API rate limit and return response if exceeded
 *
 * @param request - The incoming request
 * @param prefix - Rate limit prefix/namespace
 * @param customConfig - Optional custom rate limit config
 * @returns null if allowed, Response if rate limited
 */
export async function checkApiRateLimit(
  request: Request,
  prefix: string = "api",
  customConfig?: RateLimitConfig,
  { failClosed = false }: { failClosed?: boolean } = {}
): Promise<Response | null> {
  const ip = getClientIp(request);
  const config = customConfig || RATE_LIMITS.api;
  const result = await checkRateLimit(ip, prefix, config, { failClosed });

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
          ...rateLimitHeaders(result),
        },
      }
    );
  }

  return null;
}
