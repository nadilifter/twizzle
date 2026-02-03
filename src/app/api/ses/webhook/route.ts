import { NextRequest, NextResponse } from "next/server";
import {
  handleEmailDelivery,
  handleEmailBounce,
  handleEmailComplaint,
  handleEmailOpen,
  handleEmailClick,
} from "@/lib/email-campaign-service";

/**
 * AWS SES Webhook Handler
 *
 * This endpoint receives SNS notifications from AWS SES for:
 * - Delivery notifications
 * - Bounce notifications
 * - Complaint notifications
 * - Open tracking
 * - Click tracking
 *
 * Setup in AWS:
 * 1. Create SNS topic for SES notifications
 * 2. Subscribe this endpoint to the SNS topic
 * 3. Configure SES to publish events to the SNS topic
 */

interface SNSMessage {
  Type: "SubscriptionConfirmation" | "Notification" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string; // For SubscriptionConfirmation
  UnsubscribeURL?: string;
  Token?: string;
}

interface SESNotification {
  notificationType: "Delivery" | "Bounce" | "Complaint" | "Open" | "Click";
  mail: {
    timestamp: string;
    source: string;
    sourceArn: string;
    sendingAccountId: string;
    messageId: string;
    destination: string[];
    headersTruncated: boolean;
    headers: Array<{ name: string; value: string }>;
  };
  delivery?: {
    timestamp: string;
    processingTimeMillis: number;
    recipients: string[];
    smtpResponse: string;
    reportingMTA: string;
  };
  bounce?: {
    bounceType: "Permanent" | "Transient" | "Undetermined";
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      action?: string;
      status?: string;
      diagnosticCode?: string;
    }>;
    timestamp: string;
    feedbackId: string;
  };
  complaint?: {
    complainedRecipients: Array<{ emailAddress: string }>;
    timestamp: string;
    feedbackId: string;
    complaintFeedbackType?: string;
  };
  open?: {
    timestamp: string;
    userAgent: string;
    ipAddress: string;
  };
  click?: {
    timestamp: string;
    ipAddress: string;
    userAgent: string;
    link: string;
  };
}

// POST /api/ses/webhook - Handle SES SNS notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    let snsMessage: SNSMessage;

    try {
      snsMessage = JSON.parse(body);
    } catch {
      console.error("Failed to parse SNS message:", body);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Handle SNS subscription confirmation
    if (snsMessage.Type === "SubscriptionConfirmation") {
      // In production, you should verify the signature and confirm the subscription
      // For now, log the confirmation URL
      console.log("SNS Subscription Confirmation URL:", snsMessage.SubscribeURL);
      
      // Auto-confirm by fetching the SubscribeURL
      if (snsMessage.SubscribeURL) {
        try {
          await fetch(snsMessage.SubscribeURL);
          console.log("SNS subscription confirmed");
        } catch (error) {
          console.error("Failed to confirm SNS subscription:", error);
        }
      }
      
      return NextResponse.json({ message: "Subscription confirmation received" });
    }

    // Handle unsubscribe confirmation
    if (snsMessage.Type === "UnsubscribeConfirmation") {
      console.log("SNS Unsubscribe Confirmation received");
      return NextResponse.json({ message: "Unsubscribe confirmation received" });
    }

    // Handle actual notifications
    if (snsMessage.Type === "Notification") {
      let notification: SESNotification;

      try {
        notification = JSON.parse(snsMessage.Message);
      } catch {
        console.error("Failed to parse SES notification:", snsMessage.Message);
        return NextResponse.json({ error: "Invalid notification format" }, { status: 400 });
      }

      const sesMessageId = notification.mail.messageId;

      switch (notification.notificationType) {
        case "Delivery":
          await handleEmailDelivery(sesMessageId);
          break;

        case "Bounce":
          if (notification.bounce) {
            await handleEmailBounce(
              sesMessageId,
              notification.bounce.bounceType,
              notification.bounce.bounceSubType
            );
          }
          break;

        case "Complaint":
          await handleEmailComplaint(sesMessageId);
          break;

        case "Open":
          await handleEmailOpen(sesMessageId);
          break;

        case "Click":
          await handleEmailClick(sesMessageId);
          break;

        default:
          console.log("Unknown notification type:", notification.notificationType);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Message type not handled" });
  } catch (error) {
    console.error("Error processing SES webhook:", error);
    // Return 200 to prevent SNS from retrying
    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }
}

// GET /api/ses/webhook - Health check / verification endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "SES webhook endpoint is active",
  });
}
