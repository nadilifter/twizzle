import { NextRequest, NextResponse } from "next/server";
import MessageValidator from "sns-validator";
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
 * All incoming messages are verified using the `sns-validator` library,
 * which checks the SNS message signature against Amazon's signing certificate.
 *
 * Setup in AWS:
 * 1. Create SNS topic for SES notifications
 * 2. Subscribe this endpoint to the SNS topic
 * 3. Configure SES to publish events to the SNS topic
 * 4. Set SNS_TOPIC_ARN env var to restrict accepted topics (optional but recommended)
 */

const snsValidator = new MessageValidator();

function validateSnsMessage(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    snsValidator.validate(body, (err, message) => {
      if (err) reject(err);
      else if (message) resolve(message);
      else reject(new Error("SNS validation returned no message"));
    });
  });
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
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(body);
    } catch {
      console.error("Failed to parse SNS message");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Verify the SNS message signature before processing anything
    let snsMessage: Record<string, unknown>;
    try {
      snsMessage = await validateSnsMessage(parsed);
    } catch (error) {
      console.error("SNS signature verification failed:", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "Invalid SNS signature" }, { status: 403 });
    }

    // Optional TopicArn allowlist — restrict to known SES notification topics
    const allowedTopicArn = process.env.SNS_TOPIC_ARN;
    if (allowedTopicArn && snsMessage.TopicArn !== allowedTopicArn) {
      console.error("SNS TopicArn mismatch:", snsMessage.TopicArn);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messageType = snsMessage.Type as string;

    // Handle SNS subscription confirmation (signature already verified above)
    if (messageType === "SubscriptionConfirmation") {
      const subscribeUrl = snsMessage.SubscribeURL as string | undefined;
      if (subscribeUrl) {
        try {
          await fetch(subscribeUrl);
          console.log("SNS subscription confirmed for topic:", snsMessage.TopicArn);
        } catch (error) {
          console.error("Failed to confirm SNS subscription:", error);
        }
      }
      return NextResponse.json({ message: "Subscription confirmation received" });
    }

    // Handle unsubscribe confirmation
    if (messageType === "UnsubscribeConfirmation") {
      console.log("SNS Unsubscribe Confirmation received");
      return NextResponse.json({ message: "Unsubscribe confirmation received" });
    }

    // Handle actual notifications
    if (messageType === "Notification") {
      let notification: SESNotification;

      try {
        notification = JSON.parse(snsMessage.Message as string);
      } catch {
        console.error("Failed to parse SES notification payload");
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
