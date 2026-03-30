import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isRedisAvailable } from "@/lib/redis";
import { isAdyenConfigured } from "@/lib/adyen";
import { isTwilioConfigured } from "@/lib/twilio";

export const dynamic = "force-dynamic";

/**
 * Health Check Endpoint
 *
 * Returns the health status of the application and its dependencies.
 * Used by load balancers, container orchestrators, and monitoring systems.
 *
 * Response codes:
 *   - 200: All systems operational
 *   - 503: One or more critical dependencies are down
 */

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    adyen: CheckResult;
    twilio: CheckResult;
  };
}

interface CheckResult {
  status: "ok" | "error" | "unconfigured";
  latency?: number;
  message?: string;
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  // Perform health checks in parallel
  const [dbCheck, redisCheck, adyenCheck, twilioCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkAdyen(),
    checkTwilio(),
  ]);

  // Determine overall status
  // Database is critical, others are not
  let overallStatus: HealthStatus["status"] = "healthy";

  if (dbCheck.status === "error") {
    overallStatus = "unhealthy";
  } else if (
    redisCheck.status === "error" ||
    adyenCheck.status === "error" ||
    twilioCheck.status === "error"
  ) {
    overallStatus = "degraded";
  }

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbCheck,
      redis: redisCheck,
      adyen: adyenCheck,
      twilio: twilioCheck,
    },
  };

  // Return appropriate status code
  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(healthStatus, {
    status: statusCode,
    headers: {
      // Prevent caching of health checks
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    // Simple query to verify database connectivity
    await db.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      latency: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Database health check failed:", error);
    return {
      status: "error",
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Check Redis connectivity (optional dependency)
 */
async function checkRedis(): Promise<CheckResult> {
  if (!isRedisAvailable()) {
    return {
      status: "unconfigured",
      message: "Redis not configured",
    };
  }

  const startTime = Date.now();

  try {
    // Import redis client
    const { redis } = await import("@/lib/redis");
    if (!redis) {
      return {
        status: "unconfigured",
        message: "Redis client not initialized",
      };
    }

    // Simple ping to verify connectivity
    await redis.ping();

    return {
      status: "ok",
      latency: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Redis health check failed:", error);
    return {
      status: "error",
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Check Adyen configuration (optional dependency)
 */
async function checkAdyen(): Promise<CheckResult> {
  if (!isAdyenConfigured()) {
    return {
      status: "unconfigured",
      message: "Adyen not configured",
    };
  }

  return {
    status: "ok",
  };
}

/**
 * Check Twilio configuration (optional dependency)
 */
async function checkTwilio(): Promise<CheckResult> {
  if (!isTwilioConfigured()) {
    return {
      status: "unconfigured",
      message: "Twilio not configured",
    };
  }

  return {
    status: "ok",
  };
}

/**
 * HEAD request for simple liveness check
 */
export async function HEAD(): Promise<NextResponse> {
  try {
    await db.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
