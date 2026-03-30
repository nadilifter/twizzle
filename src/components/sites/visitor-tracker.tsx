"use client";

import { useEffect, useRef } from "react";

interface VisitorTrackerProps {
  organizationId: string;
}

/**
 * Anonymous visitor tracking component
 *
 * - Uses a daily cookie to identify unique visitors (no PII)
 * - Cookie contains only a random UUID, regenerated daily
 * - Sends tracking data via navigator.sendBeacon (non-blocking)
 * - Falls back to fetch if sendBeacon unavailable
 */
export function VisitorTracker({ organizationId }: VisitorTrackerProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only track once per page load
    if (hasTracked.current) return;
    hasTracked.current = true;

    trackVisitor(organizationId);
  }, [organizationId]);

  // This component renders nothing
  return null;
}

/**
 * Cookie name for daily visitor ID
 */
const VISITOR_COOKIE_NAME = "_uv";

/**
 * Get or create a daily visitor ID
 * Returns existing ID if cookie exists and is from today
 * Otherwise generates a new random ID
 */
function getOrCreateVisitorId(): { visitorId: string; isNew: boolean } {
  const today = formatDate(new Date());
  const existingCookie = getCookie(VISITOR_COOKIE_NAME);

  if (existingCookie) {
    // Cookie format: "visitorId|date"
    const [visitorId, cookieDate] = existingCookie.split("|");
    if (cookieDate === today && visitorId) {
      return { visitorId, isNew: false };
    }
  }

  // Generate new visitor ID (random, no PII)
  const visitorId = generateVisitorId();

  // Set cookie to expire at midnight
  const expiry = getMidnightExpiry();
  setCookie(VISITOR_COOKIE_NAME, `${visitorId}|${today}`, expiry);

  return { visitorId, isNew: true };
}

/**
 * Detect device type based on user agent
 * Returns "mobile" for phones/tablets, "desktop" for everything else
 */
function getDeviceType(): "mobile" | "desktop" {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "desktop";
  }

  const ua = navigator.userAgent.toLowerCase();
  const mobileKeywords =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/;

  return mobileKeywords.test(ua) ? "mobile" : "desktop";
}

/**
 * Track a visitor
 */
async function trackVisitor(organizationId: string): Promise<void> {
  try {
    const { visitorId, isNew } = getOrCreateVisitorId();

    // Only send tracking request for new daily visitors
    // (Redis SADD handles deduplication, but this reduces requests)
    if (!isNew) return;

    const today = formatDate(new Date());
    const deviceType = getDeviceType();

    const payload = JSON.stringify({
      visitorId,
      date: today,
      deviceType,
    });

    // Use sendBeacon for non-blocking request
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/track", blob);
    } else {
      // Fallback to fetch (fire-and-forget)
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Silently ignore errors - analytics should never break the page
      });
    }
  } catch {
    // Silently ignore errors - analytics should never break the page
  }
}

/**
 * Generate a random visitor ID (UUID-like, no PII)
 */
function generateVisitorId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get expiry timestamp for midnight tonight (local time)
 */
function getMidnightExpiry(): Date {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return midnight;
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Set a cookie with expiry
 */
function setCookie(name: string, value: string, expires: Date): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}
