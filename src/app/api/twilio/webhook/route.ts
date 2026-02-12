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
    // Parse the request body - Twilio typically sends application/x-www-form-urlencoded
    // but Messaging Services may send different content types
    const params: Record<string, string> = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // JSON body (some Twilio products/Messaging Services)
      const json = await request.json();
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === "string") {
          params[key] = value;
        } else if (value !== null && value !== undefined) {
          params[key] = String(value);
        }
      }
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      // Standard Twilio form-encoded webhooks
      const formData = await request.formData();
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });
    } else {
      // Fallback: try to read as text and parse as URL-encoded
      const text = await request.text();
      if (text) {
        const searchParams = new URLSearchParams(text);
        searchParams.forEach((value, key) => {
          params[key] = value;
        });
      }
    }

    console.log("[Twilio Webhook] Received:", {
      contentType,
      keys: Object.keys(params),
      messageSid: params.MessageSid || params.SmsSid,
      from: params.From,
      messageStatus: params.MessageStatus,
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

    console.warn("[Twilio Webhook] Unhandled payload:", JSON.stringify(params));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Twilio Webhook] Error processing:", error);
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
