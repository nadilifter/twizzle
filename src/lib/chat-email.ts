/**
 * Chat Email Module
 *
 * Handles sending chat messages as emails for WEB_EMAIL conversations,
 * using reply-to addressing for inbound routing and proper threading headers.
 */

import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { getSESConfig } from "@/lib/services-config";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const INBOUND_DOMAIN = process.env.SES_INBOUND_DOMAIN;
const HMAC_SECRET = process.env.CHAT_EMAIL_HMAC_SECRET || process.env.NEXTAUTH_SECRET || "";

function hmacTag(conversationId: string): string {
  return crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(conversationId)
    .digest("hex")
    .substring(0, 12);
}

/**
 * Strip characters that could enable email header injection
 * (newlines, carriage returns, and null bytes).
 */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]/g, "").trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the reply-to address that encodes the conversation ID with an HMAC tag.
 * Format: chat+{conversationId}.{hmacTag}@{inboundDomain}
 *
 * The HMAC prevents forged replies to arbitrary conversation IDs.
 */
export function getChatReplyToAddress(conversationId: string): string {
  const domain = INBOUND_DOMAIN || getSESConfig().fromEmail.split("@")[1];
  const tag = hmacTag(conversationId);
  return `chat+${conversationId}.${tag}@${domain}`;
}

/**
 * Extract and verify the conversation ID from an inbound email address.
 * Returns null if the address doesn't match the expected pattern or the HMAC is invalid.
 */
export function parseConversationIdFromEmail(toAddress: string): string | null {
  const match = toAddress.match(/^chat\+([a-zA-Z0-9_-]+)\.([a-f0-9]{12})@/);
  if (!match) return null;

  const [, conversationId, tag] = match;
  const expectedTag = hmacTag(conversationId);

  if (tag.length !== expectedTag.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(tag, "utf8"), Buffer.from(expectedTag, "utf8"))) {
    return null;
  }

  return conversationId;
}

type SenderRole = "admin" | "coach";

const CHAT_PATHS: Record<SenderRole, string> = {
  admin: "/dashboard/communication/chat",
  coach: "/coach/chat",
};

const GUARDIAN_CHAT_PATH = "/athletes/chat";

interface SendChatEmailOptions {
  to: string;
  body: string;
  conversationId: string;
  organizationId: string;
  senderRole?: SenderRole;
  coachName?: string;
}

interface SendChatEmailResult {
  messageId?: string;
}

/**
 * Send a chat message as an email with proper reply-to addressing
 * and threading headers.
 */
export async function sendChatEmail(
  options: SendChatEmailOptions
): Promise<SendChatEmailResult> {
  const { to, body, conversationId, organizationId, senderRole = "admin", coachName } = options;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  const rawOrgName = org?.name || "Your Organization";
  const orgName = sanitizeHeaderValue(rawOrgName);
  const replyTo = getChatReplyToAddress(conversationId);
  const sesConfig = getSESConfig();

  const isCoach = senderRole === "coach" && coachName;
  const displayName = isCoach
    ? sanitizeHeaderValue(coachName)
    : orgName;
  const fromAddress = `${displayName} <${sesConfig.fromEmail}>`;
  const subject = isCoach
    ? `New message from ${displayName} at ${orgName}`
    : `New message from ${orgName}`;

  const baseUrl = process.env.NEXTAUTH_URL || "";
  const portalUrl = `${baseUrl}${GUARDIAN_CHAT_PATH}`;

  const escapedBody = escapeHtml(body).replace(/\n/g, "<br>");

  const html = buildChatEmailHtml({
    body: escapedBody,
    orgName: escapeHtml(orgName),
    senderName: isCoach ? escapeHtml(displayName) : null,
    portalUrl: escapeHtml(portalUrl),
    senderRole,
  });

  const text = `${body}\n\n---\nReply to this email to respond, or view in the portal: ${portalUrl}`;

  logger.info("[CHAT EMAIL] Sending chat email", {
    to,
    conversationId,
    organizationId,
    senderRole,
  });

  const result = await sendEmail({
    to: [to],
    subject: sanitizeHeaderValue(subject),
    html,
    text,
    from: fromAddress,
    replyTo,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send chat email");
  }

  return { messageId: result.messageId };
}

/**
 * Get the chat portal path for a given sender role.
 * Useful for building links in notification emails sent TO admins/coaches.
 */
export function getChatPath(role: SenderRole): string {
  return CHAT_PATHS[role];
}

function buildChatEmailHtml(opts: {
  body: string;
  orgName: string;
  senderName: string | null;
  portalUrl: string;
  senderRole: SenderRole;
}): string {
  const year = new Date().getFullYear();
  const headerLine = opts.senderName
    ? `${opts.senderName} <span style="color:#a1a1aa;font-weight:400;">via ${opts.orgName}</span>`
    : opts.orgName;
  const footerAttribution = opts.senderName
    ? `${opts.senderName}, a coach at ${opts.orgName},`
    : `An admin at ${opts.orgName}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Message from ${opts.senderName || opts.orgName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 8px; padding: 24px; border: 1px solid #e4e4e7; }
    .sender { font-size: 14px; font-weight: 600; color: #71717a; margin-bottom: 16px; }
    .message-body { font-size: 15px; line-height: 1.6; color: #18181b; }
    .divider { border: none; border-top: 1px solid #e4e4e7; margin: 20px 0; }
    .footer { font-size: 12px; color: #a1a1aa; text-align: center; margin-top: 16px; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="sender">${headerLine}</div>
      <div class="message-body">${opts.body}</div>
      <hr class="divider">
      <div style="font-size: 13px; color: #71717a;">
        Reply directly to this email, or <a href="${opts.portalUrl}" style="color: #3b82f6; text-decoration: none;">view in the portal</a>.
      </div>
    </div>
    <div class="footer">
      &copy; ${year} ${opts.orgName}. ${footerAttribution} sent you this message.
    </div>
  </div>
</body>
</html>`;
}
