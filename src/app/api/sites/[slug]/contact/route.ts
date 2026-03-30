import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { getChatReplyToAddress } from "@/lib/chat-email";
import { getSESConfig } from "@/lib/services-config";
import { logger } from "@/lib/logger";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]/g, "").trim();
}

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email address"),
  message: z.string().min(1, "Message is required").max(5000),
});

/**
 * POST /api/sites/[slug]/contact
 *
 * Public contact form submission. Creates a WEB_EMAIL conversation
 * and sends a notification email to the organization.
 */
// tenant-isolation-ok: public route resolved from slug, no session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimited = await checkApiRateLimit(request, "contact", {
    limit: 5,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  try {
    const { slug } = await params;
    const body = await request.json();
    const { name, email, message } = contactSchema.parse(body);
    const senderEmail = email.toLowerCase().trim();

    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!config || !config.isPublished) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const org = config.organization;
    const orgEmail = org.email;

    if (!orgEmail) {
      return NextResponse.json(
        { error: "This organization has not configured a contact email" },
        { status: 422 }
      );
    }

    // Check if sender already has a user account
    const existingUser = await db.user.findUnique({
      where: { email: senderEmail },
      select: { id: true, email: true },
    });

    const now = new Date();

    const result = await db.$transaction(async (tx) => {
      let conversationId: string;

      if (existingUser) {
        // Reuse or create a conversation for this registered user
        const existing = await tx.conversation.findFirst({
          where: {
            organizationId: org.id,
            userId: existingUser.id,
            coachId: null,
          },
        });

        if (existing) {
          conversationId = existing.id;
          if (existing.status !== "OPEN") {
            await tx.conversation.update({
              where: { id: existing.id },
              data: { status: "OPEN" },
            });
          }
        } else {
          const conv = await tx.conversation.create({
            data: {
              organizationId: org.id,
              userId: existingUser.id,
              email: senderEmail,
              channel: "WEB_EMAIL",
              phoneNumber: "",
              status: "OPEN",
            },
          });
          conversationId = conv.id;
        }
      } else {
        // Anonymous visitor — check for existing conversation by email
        const existingAnon = await tx.conversation.findFirst({
          where: {
            organizationId: org.id,
            userId: null,
            email: senderEmail,
            coachId: null,
          },
        });

        if (existingAnon) {
          conversationId = existingAnon.id;
          if (existingAnon.status !== "OPEN") {
            await tx.conversation.update({
              where: { id: existingAnon.id },
              data: { status: "OPEN" },
            });
          }
        } else {
          const conv = await tx.conversation.create({
            data: {
              organizationId: org.id,
              email: senderEmail,
              channel: "WEB_EMAIL",
              phoneNumber: "",
              status: "OPEN",
            },
          });
          conversationId = conv.id;
        }
      }

      await tx.message.create({
        data: {
          organizationId: org.id,
          userId: existingUser?.id ?? null,
          conversationId,
          channel: "EMAIL",
          body: message,
          from: senderEmail,
          emailSubject: `Contact form: ${name}`,
          direction: "INBOUND",
          classification: "GENERAL",
          twilioStatus: "DELIVERED",
          deliveredAt: now,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          lastMessageBody: message.substring(0, 200),
          unreadCount: { increment: 1 },
          status: "OPEN",
        },
      });

      return conversationId;
    });

    // Send notification email to the org (non-blocking)
    const replyTo = getChatReplyToAddress(result);
    const sesConfig = getSESConfig();
    const safeName = sanitizeHeaderValue(name);
    const fromAddress = `${safeName} via ${sanitizeHeaderValue(org.name)} <${sesConfig.fromEmail}>`;

    sendEmail({
      to: [orgEmail],
      subject: sanitizeHeaderValue(`New contact message from ${safeName}`),
      html: buildContactNotificationHtml({
        senderName: name,
        senderEmail,
        message,
        orgName: org.name,
      }),
      text: `New contact form message from ${name} (${senderEmail}):\n\n${message}\n\n---\nReply to this email to respond directly.`,
      from: fromAddress,
      replyTo: replyTo,
    }).catch((err) => {
      logger.error("[CONTACT] Failed to send notification email to org", {
        error: err.message,
        organizationId: org.id,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    logger.error("[CONTACT] Contact form submission error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildContactNotificationHtml(opts: {
  senderName: string;
  senderEmail: string;
  message: string;
  orgName: string;
}): string {
  const year = new Date().getFullYear();
  const escapedMessage = escapeHtml(opts.message).replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>New contact message</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 8px; padding: 24px; border: 1px solid #e4e4e7; }
    .sender { font-size: 14px; font-weight: 600; color: #18181b; margin-bottom: 4px; }
    .sender-email { font-size: 13px; color: #71717a; margin-bottom: 16px; }
    .message-body { font-size: 15px; line-height: 1.6; color: #18181b; }
    .divider { border: none; border-top: 1px solid #e4e4e7; margin: 20px 0; }
    .footer { font-size: 12px; color: #a1a1aa; text-align: center; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="font-size: 13px; color: #71717a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">New Contact Form Message</div>
      <div class="sender">${escapeHtml(opts.senderName)}</div>
      <div class="sender-email">${escapeHtml(opts.senderEmail)}</div>
      <div class="message-body">${escapedMessage}</div>
      <hr class="divider">
      <div style="font-size: 13px; color: #71717a;">
        Reply directly to this email to respond, or view the conversation in your admin dashboard.
      </div>
    </div>
    <div class="footer">
      &copy; ${year} ${escapeHtml(opts.orgName)}. Sent via contact form.
    </div>
  </div>
</body>
</html>`;
}
