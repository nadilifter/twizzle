import { NextRequest, NextResponse } from "next/server";
import { validateSnsMessage, validateSubscribeUrl } from "@/lib/sns";
import { parseConversationIdFromEmail } from "@/lib/chat-email";
import { routeInboundEmail } from "@/lib/conversation-service";
import { checkApiRateLimit } from "@/lib/rate-limit";

/**
 * SES Inbound Email Handler
 *
 * Receives email replies via SNS when users reply to chat emails.
 * The reply-to address encodes the conversation ID as chat+{id}@domain.
 *
 * SES inbound receiving flow:
 * 1. MX record for the inbound domain points to SES
 * 2. SES receipt rule matches chat+*@domain
 * 3. Receipt rule action publishes to SNS topic
 * 4. SNS topic delivers to this webhook endpoint
 */

// tenant-isolation-ok: inbound webhook has no user session; routing is by conversation ID embedded in the email address

interface SESInboundNotification {
  notificationType: "Received";
  receipt: {
    timestamp: string;
    processingTimeMillis: number;
    recipients: string[];
    spamVerdict: { status: string };
    virusVerdict: { status: string };
    spfVerdict: { status: string };
    dkimVerdict: { status: string };
    dmarcVerdict: { status: string };
    action: { type: string; topicArn: string };
  };
  mail: {
    timestamp: string;
    source: string;
    messageId: string;
    destination: string[];
    headers: Array<{ name: string; value: string }>;
    commonHeaders: {
      from: string[];
      to: string[];
      subject: string;
      messageId: string;
    };
  };
  content?: string;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimited = await checkApiRateLimit(request, "ses-inbound", {
      limit: 120,
      windowSeconds: 60,
    });
    if (rateLimited) return rateLimited;

    const rawBody = await request.text();
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    let snsMessage: Record<string, unknown>;
    try {
      snsMessage = await validateSnsMessage(parsed);
    } catch (error) {
      console.error(
        "[SES INBOUND] SNS signature verification failed:",
        error instanceof Error ? error.message : error
      );
      return NextResponse.json({ error: "Invalid SNS signature" }, { status: 403 });
    }

    const allowedTopicArn = process.env.SES_INBOUND_SNS_TOPIC_ARN;
    if (allowedTopicArn && snsMessage.TopicArn !== allowedTopicArn) {
      console.error("[SES INBOUND] TopicArn mismatch:", snsMessage.TopicArn);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messageType = snsMessage.Type as string;

    if (messageType === "SubscriptionConfirmation") {
      const subscribeUrl = snsMessage.SubscribeURL as string | undefined;
      if (!subscribeUrl || !validateSubscribeUrl(subscribeUrl)) {
        console.error("[SES INBOUND] SubscribeURL rejected (SSRF check):", subscribeUrl);
        return NextResponse.json({ error: "Invalid SubscribeURL" }, { status: 400 });
      }
      try {
        await fetch(subscribeUrl);
        console.log("[SES INBOUND] SNS subscription confirmed");
      } catch (error) {
        console.error("[SES INBOUND] Failed to confirm subscription:", error);
      }
      return NextResponse.json({ message: "Subscription confirmation received" });
    }

    if (messageType === "UnsubscribeConfirmation") {
      return NextResponse.json({ message: "Unsubscribe confirmation received" });
    }

    if (messageType === "Notification") {
      let notification: SESInboundNotification;

      try {
        notification = JSON.parse(snsMessage.Message as string);
      } catch {
        console.error("[SES INBOUND] Failed to parse notification payload");
        return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
      }

      if (notification.notificationType !== "Received") {
        return NextResponse.json({ message: "Not an inbound email notification" });
      }

      const { receipt } = notification;
      if (receipt.spamVerdict?.status === "FAIL" || receipt.virusVerdict?.status === "FAIL") {
        console.warn("[SES INBOUND] Email rejected by spam/virus filter", {
          spam: receipt.spamVerdict?.status,
          virus: receipt.virusVerdict?.status,
          from: notification.mail.source,
        });
        return NextResponse.json({ message: "Email rejected by content filter" });
      }

      const recipients = receipt.recipients || notification.mail.destination;
      let conversationId: string | null = null;
      for (const recipient of recipients) {
        conversationId = parseConversationIdFromEmail(recipient);
        if (conversationId) break;
      }

      if (!conversationId) {
        console.warn("[SES INBOUND] No conversation ID found in recipients:", recipients);
        return NextResponse.json({ message: "No matching conversation address" });
      }

      const fromAddress = notification.mail.commonHeaders.from?.[0] || notification.mail.source;
      const subject = notification.mail.commonHeaders.subject || "(no subject)";

      let textBody = "";
      let htmlBody: string | null = null;

      if (notification.content) {
        const { extractEmailBody } = await import("@/lib/email-parser");
        const parsed = extractEmailBody(notification.content);
        textBody = parsed.text;
        htmlBody = parsed.html;
      } else {
        textBody = "(email body not available — S3 action required for full content)";
      }

      const MAX_BODY_LENGTH = 100_000;
      if (textBody.length > MAX_BODY_LENGTH) {
        textBody = textBody.substring(0, MAX_BODY_LENGTH);
      }
      if (htmlBody && htmlBody.length > MAX_BODY_LENGTH) {
        htmlBody = htmlBody.substring(0, MAX_BODY_LENGTH);
      }

      await routeInboundEmail({
        conversationId,
        senderEmail: notification.mail.source,
        from: fromAddress,
        subject,
        textBody,
        htmlBody,
        sesMessageId: notification.mail.messageId,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Message type not handled" });
  } catch (error) {
    console.error("[SES INBOUND] Error processing webhook:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "SES inbound email endpoint is active",
  });
}
