import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSignature, getWebhookUrl } from "@/lib/twilio";
import { handleStatusCallback, handleInboundSms } from "@/lib/sms-service";

/**
 * Twilio Webhook Handler
 *
 * Handles:
 * - Status callbacks for outbound messages (delivered, failed, etc.)
 * - Inbound messages (for opt-out processing)
 */

// POST /api/twilio/webhook - Handle Twilio callbacks
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature validation
    const formData = await request.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // Validate Twilio signature in production
    if (process.env.NODE_ENV === "production") {
      const signature = request.headers.get("x-twilio-signature");

      if (!signature) {
        console.warn("Missing Twilio signature");
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }

      // Build the full webhook URL
      const webhookUrl = getWebhookUrl();
      if (webhookUrl) {
        const isValid = validateWebhookSignature(signature, webhookUrl, params);

        if (!isValid) {
          console.warn("Invalid Twilio signature");
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
    }

    // Determine the type of webhook
    const messageSid = params.MessageSid || params.SmsSid;
    const messageStatus = params.MessageStatus;
    const direction = params.SmsStatus ? "inbound" : "outbound";

    // Handle inbound messages (for opt-out)
    if (params.Body && params.From && !messageStatus) {
      await handleInboundSms({
        From: params.From,
        To: params.To,
        Body: params.Body,
        MessageSid: messageSid,
      });

      // Return TwiML to acknowledge (empty response)
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Handle status callbacks
    if (messageSid && messageStatus) {
      await handleStatusCallback({
        MessageSid: messageSid,
        MessageStatus: messageStatus,
        ErrorCode: params.ErrorCode,
        ErrorMessage: params.ErrorMessage,
        Price: params.Price,
        PriceUnit: params.PriceUnit,
      });

      return NextResponse.json({ success: true });
    }

    console.warn("Unhandled webhook payload:", params);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing Twilio webhook:", error);
    // Return 200 to prevent Twilio from retrying
    return NextResponse.json({ error: "Processing error" }, { status: 200 });
  }
}

// GET /api/twilio/webhook - Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Twilio webhook endpoint is active",
  });
}
