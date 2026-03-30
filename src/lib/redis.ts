import { Redis } from "@upstash/redis";

/**
 * Upstash Redis client for visitor analytics
 *
 * Uses REST-based API for serverless compatibility.
 * Falls back gracefully if not configured (returns null).
 */

// Check if Redis is configured
const isConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Create Redis client only if configured
export const redis = isConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redis !== null;
}

/**
 * Device type for visitor analytics
 */
export type DeviceType = "mobile" | "desktop";

/**
 * Visitor analytics key helpers
 */
export const visitorKeys = {
  /**
   * Get the Redis key for a day's visitor set (legacy, total)
   * Format: visitors:{organizationId}:{YYYY-MM-DD}
   * @deprecated Use dailyByDevice instead for new data
   */
  daily: (organizationId: string, date: string) => `visitors:${organizationId}:${date}`,

  /**
   * Get the Redis key for a day's visitor set by device type
   * Format: visitors:{organizationId}:{YYYY-MM-DD}:{deviceType}
   */
  dailyByDevice: (organizationId: string, date: string, deviceType: DeviceType) =>
    `visitors:${organizationId}:${date}:${deviceType}`,

  /**
   * Get the Redis key for desktop visitors on a specific day
   */
  desktop: (organizationId: string, date: string) => `visitors:${organizationId}:${date}:desktop`,

  /**
   * Get the Redis key for mobile visitors on a specific day
   */
  mobile: (organizationId: string, date: string) => `visitors:${organizationId}:${date}:mobile`,

  /**
   * Get the pattern for all visitor keys for an organization
   */
  pattern: (organizationId: string) => `visitors:${organizationId}:*`,
};

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * TTL for visitor data (90 days in seconds)
 */
export const VISITOR_TTL_SECONDS = 90 * 24 * 60 * 60;
