import twilio from "twilio";
import type { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";

/**
 * Twilio SMS Integration
 *
 * Environment variables:
 *   - TWILIO_ACCOUNT_SID: Your Twilio Account SID
 *   - TWILIO_AUTH_TOKEN: Your Twilio Auth Token
 *   - TWILIO_MESSAGING_SERVICE_SID: Messaging Service SID (recommended for A2P)
 *   - TWILIO_PHONE_NUMBER: Fallback phone number if no messaging service
 *   - TWILIO_ENVIRONMENT: "TEST" or "LIVE" (affects logging/behavior)
 *   - TWILIO_WEBHOOK_URL: Base URL for webhooks (defaults to NEXTAUTH_URL)
 */

// Validate required configuration
if (!process.env.TWILIO_ACCOUNT_SID) {
  console.warn("TWILIO_ACCOUNT_SID is not set - SMS will not work");
}

if (!process.env.TWILIO_AUTH_TOKEN) {
  console.warn("TWILIO_AUTH_TOKEN is not set - SMS will not work");
}

if (!process.env.TWILIO_MESSAGING_SERVICE_SID && !process.env.TWILIO_PHONE_NUMBER) {
  console.warn(
    "Neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_PHONE_NUMBER is set - SMS will not work"
  );
}

/**
 * Get Twilio environment (TEST or LIVE)
 */
export function getTwilioEnvironment(): "TEST" | "LIVE" {
  const envValue = process.env.TWILIO_ENVIRONMENT?.toUpperCase();

  if (envValue === "LIVE") {
    return "LIVE";
  }

  // Default to TEST for safety
  return "TEST";
}

const twilioEnvironment = getTwilioEnvironment();

// Log environment in development
if (process.env.NODE_ENV === "development") {
  console.log(`Twilio initialized in ${twilioEnvironment} mode`);
}

// Initialize Twilio client (lazy initialization)
let twilioClient: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!twilioClient) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials not configured");
    }
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Fetch the set of toll-free numbers that have been verified (TWILIO_APPROVED).
 * Used by the number pool to avoid routing through unverified numbers.
 */
export async function fetchVerifiedTollFreeNumbers(): Promise<Set<string>> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return new Set();
  }
  const client = getClient();
  const verifications = await client.messaging.v1.tollfreeVerifications.list();
  return new Set(
    verifications.filter((v) => v.status === "TWILIO_APPROVED").map((v) => v.tollfreePhoneNumber)
  );
}

/**
 * Check if Twilio is properly configured
 */
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_PHONE_NUMBER)
  );
}

/**
 * Get the webhook URL for status callbacks
 * Returns null for localhost URLs since Twilio can't reach them
 */
export function getWebhookUrl(path: string = "/api/twilio/webhook"): string | null {
  const baseUrl = process.env.TWILIO_WEBHOOK_URL || process.env.NEXTAUTH_URL || "";

  // Skip webhook for localhost - Twilio can't reach it
  if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
    return null;
  }

  return `${baseUrl}${path}`;
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If no country code, assume US (+1)
  if (!cleaned.startsWith("+")) {
    // Remove leading 1 if present (US numbers sometimes start with 1)
    if (cleaned.startsWith("1") && cleaned.length === 11) {
      cleaned = cleaned.substring(1);
    }
    // Add US country code
    cleaned = "+1" + cleaned;
  }

  return cleaned;
}

/**
 * Validate E.164 phone number format
 */
export function isValidE164(phone: string): boolean {
  // E.164: + followed by 1-15 digits
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Calculate SMS segment count.
 *
 * GSM-7 basic charset: 160 chars per single segment, 153 per multi-part segment.
 * GSM-7 extended chars ({, }, [, ], ~, \, ^, |, €): each costs 2 char slots
 *   because they require an escape byte.
 * UCS-2 (any non-GSM-7 character): 70 chars per single segment, 67 per multi-part.
 */
export function calculateSegments(message: string): number {
  const gsm7Basic = new Set(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ!\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑܧ¿abcdefghijklmnopqrstuvwxyzäöñüà"
  );
  const gsm7Extended = new Set("{}[]~\\^|€");

  let isGsm7 = true;
  let gsm7Length = 0;

  for (const char of message) {
    if (gsm7Basic.has(char)) {
      gsm7Length += 1;
    } else if (gsm7Extended.has(char)) {
      gsm7Length += 2;
    } else {
      isGsm7 = false;
      break;
    }
  }

  if (isGsm7) {
    if (gsm7Length <= 160) return 1;
    return Math.ceil(gsm7Length / 153);
  }

  const ucs2Length = message.length;
  if (ucs2Length <= 70) return 1;
  return Math.ceil(ucs2Length / 67);
}

export interface SendSmsOptions {
  to: string;
  body: string;
  from?: string;
  statusCallback?: string;
  organizationId?: string;
  campaignId?: string;
}

export interface SendSmsResult {
  success: boolean;
  sid?: string;
  status?: string;
  segments?: number;
  error?: string;
  errorCode?: string;
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
  const { to, body, statusCallback } = options;

  if (!isTwilioConfigured()) {
    return {
      success: false,
      error: "Twilio is not configured",
      errorCode: "NOT_CONFIGURED",
    };
  }

  if (body.length > 1600) {
    return {
      success: false,
      error: "SMS body exceeds Twilio's 1600 character limit",
      errorCode: "BODY_TOO_LONG",
    };
  }

  // In local/test environments, redirect all SMS to the test phone number
  const testPhoneNumber = process.env.TWILIO_TEST_PHONENUMBER;
  const resolvedTo = testPhoneNumber ? testPhoneNumber : to;

  // Normalize and validate phone number
  const normalizedTo = normalizePhoneNumber(resolvedTo);
  if (!isValidE164(normalizedTo)) {
    return {
      success: false,
      error: `Invalid phone number format: ${resolvedTo}`,
      errorCode: "INVALID_PHONE",
    };
  }

  const segments = calculateSegments(body);

  try {
    const client = getClient();

    const messageOptions: Parameters<typeof client.messages.create>[0] = {
      to: normalizedTo,
      body,
    };

    // Only add statusCallback if we have a valid public URL
    const webhookUrl = statusCallback || getWebhookUrl();
    if (webhookUrl) {
      messageOptions.statusCallback = webhookUrl;
    }

    // Route through the Messaging Service for A2P/toll-free compliance.
    // When a pool number is specified, pass both messagingServiceSid and from
    // so the Messaging Service applies compliance while using the requested
    // sender. All pool numbers must be toll-free and added to the service.
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      messageOptions.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
      if (options.from) {
        messageOptions.from = options.from;
      }
    } else if (options.from) {
      messageOptions.from = options.from;
    } else if (process.env.TWILIO_PHONE_NUMBER) {
      messageOptions.from = process.env.TWILIO_PHONE_NUMBER;
    }

    const message: MessageInstance = await client.messages.create(messageOptions);

    return {
      success: true,
      sid: message.sid,
      status: message.status,
      segments,
    };
  } catch (error) {
    console.error("Error sending SMS:", error);

    const twilioError = error as { code?: number; message?: string };
    return {
      success: false,
      error: twilioError.message || "Failed to send SMS",
      errorCode: twilioError.code?.toString() || "UNKNOWN",
      segments,
    };
  }
}

/**
 * Validate Twilio webhook signature
 */
export function validateWebhookSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!process.env.TWILIO_AUTH_TOKEN) {
    console.warn("Cannot validate webhook: TWILIO_AUTH_TOKEN not set");
    return false;
  }

  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, params);
}

/**
 * Get message status from Twilio
 */
export async function getMessageStatus(sid: string): Promise<MessageInstance | null> {
  if (!isTwilioConfigured()) {
    return null;
  }

  try {
    const client = getClient();
    return await client.messages(sid).fetch();
  } catch (error) {
    console.error("Error fetching message status:", error);
    return null;
  }
}

/**
 * Map Twilio status to our SmsStatus enum
 */
export function mapTwilioStatus(
  twilioStatus: string
): "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "UNDELIVERED" | "FAILED" {
  const statusMap: Record<
    string,
    "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "UNDELIVERED" | "FAILED"
  > = {
    queued: "QUEUED",
    accepted: "QUEUED",
    sending: "SENDING",
    sent: "SENT",
    delivered: "DELIVERED",
    undelivered: "UNDELIVERED",
    failed: "FAILED",
    canceled: "FAILED",
  };

  return statusMap[twilioStatus.toLowerCase()] || "QUEUED";
}
