/**
 * Email Service
 *
 * This module provides a unified interface for sending emails that works with:
 * - Amazon SES in cloud environments (production, staging, development)
 * - MailHog in local development via SMTP (catches all emails for inspection)
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getSESConfig } from "./services-config";
import { getCurrentEnvironment } from "./env-domains";
import { logger } from "./logger";

// SES Client singleton (for cloud environments)
let sesClient: SESClient | null = null;

// Nodemailer transporter singleton (for local development)
let smtpTransporter: Transporter | null = null;

/**
 * Get or create the SES client for cloud environments
 */
function getSESClient(): SESClient {
  if (sesClient) {
    return sesClient;
  }

  const config = getSESConfig();

  sesClient = new SESClient({
    region: config.region,
    // For cloud environments, use standard credentials
    ...(process.env.AWS_ACCESS_KEY_ID && {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    }),
  });

  return sesClient;
}

/**
 * Get or create the nodemailer SMTP transporter for local development
 * Connects to MailHog on localhost:1025
 */
function getSMTPTransporter(): Transporter {
  if (smtpTransporter) {
    return smtpTransporter;
  }

  const smtpHost = process.env.SMTP_HOST || "localhost";
  const smtpPort = parseInt(process.env.SMTP_PORT || "1025", 10);

  smtpTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false, // MailHog doesn't use TLS
    ignoreTLS: true,
  });

  return smtpTransporter;
}

/**
 * Email sending options
 */
export interface SendEmailOptions {
  /** Recipient email addresses */
  to: string[];
  /** Email subject */
  subject: string;
  /** HTML body content */
  html: string;
  /** Plain text body content (optional, fallback for HTML) */
  text?: string;
  /** From email address (optional, uses default from config) */
  from?: string;
  /** Reply-to email address */
  replyTo?: string;
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
}

/**
 * Email sending result
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using SMTP (local) or SES (cloud)
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const config = getSESConfig();
  const currentEnv = getCurrentEnvironment();
  const fromAddress = options.from || config.fromEmail;

  // Local development: Use nodemailer with SMTP to MailHog
  if (currentEnv === "local") {
    return sendEmailViaSMTP(options, fromAddress);
  }

  // Cloud environments: Use AWS SES
  return sendEmailViaSES(options, fromAddress, config);
}

/**
 * Send email via SMTP (for local development with MailHog)
 */
async function sendEmailViaSMTP(
  options: SendEmailOptions,
  fromAddress: string
): Promise<SendEmailResult> {
  const transporter = getSMTPTransporter();

  logger.info("[EMAIL] Sending email via SMTP/MailHog", {
    to: options.to,
    from: fromAddress,
    subject: options.subject,
  });

  try {
    const result = await transporter.sendMail({
      from: fromAddress,
      to: options.to.join(", "),
      cc: options.cc?.join(", "),
      bcc: options.bcc?.join(", "),
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info("[EMAIL] Email sent successfully via SMTP", {
      messageId: result.messageId,
      to: options.to,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error: any) {
    logger.error("[EMAIL] Failed to send email via SMTP", {
      error: error.message,
      to: options.to,
      subject: options.subject,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send email via AWS SES (for cloud environments)
 */
async function sendEmailViaSES(
  options: SendEmailOptions,
  fromAddress: string,
  config: ReturnType<typeof getSESConfig>
): Promise<SendEmailResult> {
  const client = getSESClient();

  // In sandbox mode, check if recipients are verified
  if (config.mode === "sandbox") {
    logger.warn("[EMAIL] SES is in sandbox mode - recipients must be verified", {
      to: options.to,
    });
  }

  if (config.configurationSetName) {
    logger.info("[EMAIL] Using SES Configuration Set", {
      configurationSetName: config.configurationSetName,
    });
  }

  try {
    const command = new SendEmailCommand({
      Source: fromAddress,
      Destination: {
        ToAddresses: options.to,
        CcAddresses: options.cc,
        BccAddresses: options.bcc,
      },
      ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
      Message: {
        Subject: {
          Data: options.subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: options.html,
            Charset: "UTF-8",
          },
          ...(options.text && {
            Text: {
              Data: options.text,
              Charset: "UTF-8",
            },
          }),
        },
      },
      // Route events through SES Configuration Set for bounce/complaint handling
      ...(config.configurationSetName && {
        ConfigurationSetName: config.configurationSetName,
      }),
    });

    const response = await client.send(command);

    logger.info("[EMAIL] Email sent successfully via SES", {
      messageId: response.MessageId,
      to: options.to,
    });

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error: any) {
    logger.error("[EMAIL] Failed to send email via SES", {
      error: error.message,
      to: options.to,
      subject: options.subject,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send a templated email
 * This is a convenience wrapper for common email templates
 */
export async function sendTemplatedEmail(
  template: EmailTemplate,
  to: string[],
  data: Record<string, string>
): Promise<SendEmailResult> {
  const { subject, html, text } = renderTemplate(template, data);

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}

/**
 * Email template types
 */
export type EmailTemplate =
  | "welcome"
  | "password-reset"
  | "no-account"
  | "invitation"
  | "invitation-existing-user"
  | "registration-confirmation"
  | "payment-confirmation"
  | "checkout-receipt"
  | "announcement"
  | "feedback-roadmap"
  | "mfa-code"
  | "email-login-code"
  | "no-account-login"
  | "signup-verification-code"
  | "subscription-payment-success"
  | "subscription-payment-failed"
  | "subscription-deactivation-warning"
  | "subscription-deactivated"
  | "holiday-reminder"
  | "payment-method-expiring";

/**
 * Wrap email body content in a branded Uplifter layout.
 * Uses table-based structure for cross-client compatibility (Outlook, Gmail, Apple Mail).
 */
function wrapInBrandedLayout(options: { preheaderText: string; bodyHtml: string }): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Uplifter</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    td, th, div, p, a, h1, h2, h3, h4, h5, h6 { font-family: 'Segoe UI', Arial, sans-serif; }
  </style>
  <![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 0 16px !important; }
      .code-text { font-size: 28px !important; letter-spacing: 4px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #f4f4f7; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!-- Preheader (hidden inbox preview text) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${options.preheaderText}</div>
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 32px 16px 16px;">
        <!-- Content card -->
        <table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
          <!-- Purple accent stripe -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #5655ED, #A07CFE); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <!-- Body content -->
          <tr>
            <td style="padding: 40px 40px 32px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 24px; color: #374151;">
              <p style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #5655ED; letter-spacing: -0.3px;">Uplifter</p>
              ${options.bodyHtml}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px;">
          <tr>
            <td align="center" style="padding: 24px 0 32px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; line-height: 18px; color: #9ca3af;">
              &copy; ${year} Uplifter Inc. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Render an email template with data
 */
function renderTemplate(
  template: EmailTemplate,
  data: Record<string, string>
): { subject: string; html: string; text: string } {
  // Simple template rendering - replace {{key}} with values
  const render = (str: string) => {
    return Object.entries(data).reduce(
      (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, "g"), value),
      str
    );
  };

  const templates: Record<EmailTemplate, { subject: string; html: string; text: string }> = {
    welcome: {
      subject: "Welcome to {{organizationName}}!",
      html: `
        <h1>Welcome to {{organizationName}}!</h1>
        <p>Hello {{name}},</p>
        <p>We're excited to have you join us. Your account has been created successfully.</p>
        <p>You can log in at: <a href="{{loginUrl}}">{{loginUrl}}</a></p>
        <p>Best regards,<br>{{organizationName}} Team</p>
      `,
      text: `
        Welcome to {{organizationName}}!
        
        Hello {{name}},
        
        We're excited to have you join us. Your account has been created successfully.
        
        You can log in at: {{loginUrl}}
        
        Best regards,
        {{organizationName}} Team
      `,
    },
    "password-reset": {
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1f2937;">Password Reset Request</h1>
          <p>Hello {{name}},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="margin: 24px 0;">
            <a href="{{resetUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This link will expire in {{expiresIn}}.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
      `,
      text: `
        Password Reset Request
        
        Hello {{name}},
        
        We received a request to reset your password. Use the link below to create a new password:
        
        {{resetUrl}}
        
        This link will expire in {{expiresIn}}.
        
        If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
      `,
    },
    "no-account": {
      subject: "Password Reset Attempted",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1f2937;">Password Reset Attempted</h1>
          <p>Hello,</p>
          <p>Someone (hopefully you) tried to reset the password for this email address, but we don't have an account associated with <strong>{{email}}</strong>.</p>
          <p>If you're trying to access an organization's platform, you may need to:</p>
          <ul style="color: #4b5563;">
            <li>Contact your club or organization administrator to get an invitation</li>
            <li>Sign up through your organization's website</li>
          </ul>
          <p>If you want to create a new organization on Uplifter, you can get started here:</p>
          <p style="margin: 24px 0;">
            <a href="{{signupUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Create an Organization</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `
        Password Reset Attempted
        
        Hello,
        
        Someone (hopefully you) tried to reset the password for this email address, but we don't have an account associated with {{email}}.
        
        If you're trying to access an organization's platform, you may need to:
        - Contact your club or organization administrator to get an invitation
        - Sign up through your organization's website
        
        If you want to create a new organization on Uplifter, you can get started here:
        {{signupUrl}}
        
        If you didn't request this, you can safely ignore this email.
      `,
    },
    invitation: {
      subject: "You've been invited to join {{organizationName}}",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1f2937;">You've Been Invited!</h1>
          <p>Hello,</p>
          <p>{{inviterName}} has invited you to join <strong>{{organizationName}}</strong>.</p>
          <p>Click the button below to set up your account and get started:</p>
          <p style="margin: 24px 0;">
            <a href="{{inviteUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set Up Your Account</a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This invitation will expire in 7 days.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      `,
      text: `
        You've Been Invited!
        
        Hello,
        
        {{inviterName}} has invited you to join {{organizationName}}.
        
        Click the link below to set up your account and get started:
        
        {{inviteUrl}}
        
        This invitation will expire in 7 days.
        
        If you didn't expect this invitation, you can safely ignore this email.
      `,
    },
    "invitation-existing-user": {
      subject: "{{inviterName}} invited you to join {{organizationName}}",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1f2937;">You've Been Invited to Join {{organizationName}}</h1>
          <p>Hi {{name}},</p>
          <p>{{inviterName}} has invited you to join <strong>{{organizationName}}</strong> on Uplifter.</p>
          <p>Since you already have an account, just click the button below to accept:</p>
          <p style="margin: 24px 0;">
            <a href="{{joinUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This invitation will expire in 7 days.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      `,
      text: `
        You've Been Invited to Join {{organizationName}}
        
        Hi {{name}},
        
        {{inviterName}} has invited you to join {{organizationName}} on Uplifter.
        
        Since you already have an account, just click the link below to accept:
        
        {{joinUrl}}
        
        This invitation will expire in 7 days.
        
        If you didn't expect this invitation, you can safely ignore this email.
      `,
    },
    "registration-confirmation": {
      subject: "Registration Confirmed - {{eventName}}",
      html: `
        <h1>Registration Confirmed!</h1>
        <p>Hello {{name}},</p>
        <p>Your registration for <strong>{{eventName}}</strong> has been confirmed.</p>
        <p><strong>Details:</strong></p>
        <ul>
          <li>Date: {{eventDate}}</li>
          <li>Time: {{eventTime}}</li>
          <li>Location: {{eventLocation}}</li>
        </ul>
        <p>We look forward to seeing you!</p>
      `,
      text: `
        Registration Confirmed!
        
        Hello {{name}},
        
        Your registration for {{eventName}} has been confirmed.
        
        Details:
        - Date: {{eventDate}}
        - Time: {{eventTime}}
        - Location: {{eventLocation}}
        
        We look forward to seeing you!
      `,
    },
    "payment-confirmation": {
      subject: "Payment Confirmation - {{amount}}",
      html: `
        <h1>Payment Received</h1>
        <p>Hello {{name}},</p>
        <p>We've received your payment of <strong>{{amount}}</strong>.</p>
        <p><strong>Transaction ID:</strong> {{transactionId}}</p>
        <p><strong>Description:</strong> {{description}}</p>
        <p>Thank you for your payment!</p>
      `,
      text: `
        Payment Received
        
        Hello {{name}},
        
        We've received your payment of {{amount}}.
        
        Transaction ID: {{transactionId}}
        Description: {{description}}
        
        Thank you for your payment!
      `,
    },
    "checkout-receipt": {
      subject: "Order Confirmation - {{reference}}",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #16a34a;">Order Confirmed</h1>
          <p>Hello {{name}},</p>
          <p>Your registration is complete. Here are your order details:</p>
          <p><strong>Order Reference:</strong> {{reference}}</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="text-align: left; padding: 8px 0;">Item</th>
                <th style="text-align: right; padding: 8px 0;">Amount</th>
              </tr>
            </thead>
            <tbody>{{lineItemsHtml}}</tbody>
            <tfoot>
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="padding: 4px 0;">Subtotal</td>
                <td style="padding: 4px 0; text-align: right;">{{subtotal}}</td>
              </tr>
              {{taxHtml}}
              {{processingFeeHtml}}
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 8px 0; font-weight: bold;">Total</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">{{total}}</td>
              </tr>
            </tfoot>
          </table>
          <p>You can view your receipt at any time: <a href="{{receiptUrl}}">View Receipt</a></p>
          <p>Thank you!</p>
        </div>
      `,
      text: `
        Order Confirmed

        Hello {{name}},

        Your registration is complete. Here are your order details:

        Order Reference: {{reference}}

        {{lineItemsText}}

        Subtotal: {{subtotal}}
        {{taxText}}
        {{processingFeeText}}
        Total: {{total}}

        View your receipt: {{receiptUrl}}

        Thank you!
      `,
    },
    announcement: {
      subject: "{{subject}}",
      html: `
        <h1>{{title}}</h1>
        <p>{{content}}</p>
        <p>- {{organizationName}}</p>
      `,
      text: `
        {{title}}
        
        {{content}}
        
        - {{organizationName}}
      `,
    },
    "feedback-roadmap": {
      subject: "Your feedback has been added to the Uplifter roadmap!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Great news, {{name}}!</h1>
          <p>Your feedback "<strong>{{featureTitle}}</strong>" has been added to our product roadmap.</p>
          <p>We'll keep you updated as we make progress. You can track the status at:</p>
          <p><a href="{{feedbackUrl}}" style="color: #2563eb; text-decoration: underline;">View Roadmap</a></p>
          <p>Thank you for helping us improve Uplifter!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 14px;">The Uplifter Team</p>
        </div>
      `,
      text: `
        Great news, {{name}}!
        
        Your feedback "{{featureTitle}}" has been added to our product roadmap.
        
        We'll keep you updated as we make progress. You can track the status at:
        {{feedbackUrl}}
        
        Thank you for helping us improve Uplifter!
        
        The Uplifter Team
      `,
    },
    "mfa-code": {
      subject: "Your verification code",
      html: wrapInBrandedLayout({
        preheaderText: "Your Uplifter verification code. Expires in {{expiresIn}}.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #050D22;">Verification Required</h1>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">Confirm your identity to continue signing in</p>
              <p style="margin: 0 0 24px;">We noticed it&#8217;s been a while since your last sign-in, {{name}}. To keep your account secure, please verify your identity using the code below:</p>
              <!-- Code box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0effc; border-radius: 10px; border: 1px solid #e0dffa;">
                      <tr>
                        <td style="padding: 18px 32px;">
                          <span class="code-text" style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #5655ED;">{{code}}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; text-align: center; color: #6b7280; font-size: 14px;">Or click the button below to verify directly:</p>
              <!-- CTA button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="{{verifyUrl}}" style="display: inline-block; background-color: #5655ED; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">Verify and Sign In</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 20px; font-size: 13px; color: #6b7280;">&#9200; This code expires in {{expiresIn}}.</p>
              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <!-- Security notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #374151;">&#128274; Security Notice</p>
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">If you didn&#8217;t attempt to sign in, someone may have your password. We recommend resetting it immediately. Never share this code with anyone.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Verification Required

We noticed it's been a while since your last sign-in, {{name}}. To keep your account secure, please verify your identity using the code below:

{{code}}

Or verify directly: {{verifyUrl}}

This code expires in {{expiresIn}}.

If you didn't attempt to sign in, someone may have your password. We recommend resetting it immediately. Never share this code with anyone.`,
    },
    "email-login-code": {
      subject: "Your sign-in code",
      html: wrapInBrandedLayout({
        preheaderText: "Your Uplifter sign-in code. Expires in {{expiresIn}}.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #050D22;">Sign In to Uplifter</h1>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">Use this code to access your account</p>
              <p style="margin: 0 0 24px;">Use the code below to sign in to your account:</p>
              <!-- Code box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0effc; border-radius: 10px; border: 1px solid #e0dffa;">
                      <tr>
                        <td style="padding: 18px 32px;">
                          <span class="code-text" style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #5655ED;">{{code}}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; text-align: center; color: #6b7280; font-size: 14px;">Or click the button below to sign in directly:</p>
              <!-- CTA button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="{{verifyUrl}}" style="display: inline-block; background-color: #5655ED; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">Sign In</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 20px; font-size: 13px; color: #6b7280;">&#9200; This code expires in {{expiresIn}}.</p>
              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <!-- Security notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">If you didn&#8217;t request this code, you can safely ignore this email. Never share this code with anyone.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Sign In to Uplifter

Use the code below to sign in to your account:

{{code}}

Or sign in directly: {{verifyUrl}}

This code expires in {{expiresIn}}.

If you didn't request this code, you can safely ignore this email. Never share this code with anyone.`,
    },
    "signup-verification-code": {
      subject: "Verify your email for Uplifter",
      html: wrapInBrandedLayout({
        preheaderText: "Your Uplifter verification code. Expires in {{expiresIn}}.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #050D22;">Verify Your Email</h1>
              <p style="margin: 0 0 24px;">Use the code below to verify your email address on Uplifter:</p>
              <!-- Code box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0effc; border-radius: 10px; border: 1px solid #e0dffa;">
                      <tr>
                        <td style="padding: 18px 32px;">
                          <span class="code-text" style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #5655ED;">{{code}}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 20px; font-size: 13px; color: #6b7280;">&#9200; This code expires in {{expiresIn}}.</p>
              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <!-- Security notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">If you didn&#8217;t request this code, you can safely ignore this email. Never share this code with anyone.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Verify Your Email

Use the code below to verify your email address on Uplifter:

{{code}}

This code expires in {{expiresIn}}.

If you didn't request this code, you can safely ignore this email. Never share this code with anyone.`,
    },
    "no-account-login": {
      subject: "Sign-in Attempted",
      html: wrapInBrandedLayout({
        preheaderText: "A sign-in was attempted with this email address on Uplifter.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #050D22;">Sign-in Attempted</h1>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">No account found for this email address</p>
              <p style="margin: 0 0 16px;">Someone tried to sign in with this email address, but we don&#8217;t have an account associated with <strong>{{email}}</strong>.</p>
              <p style="margin: 0 0 8px;">If you&#8217;re trying to access an organization&#8217;s platform, you may need to:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 20px;">
                <tr>
                  <td style="padding: 4px 0 4px 16px; color: #374151; font-size: 14px;">&#8226;&ensp;Contact your club or organization administrator to get an invitation</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0 4px 16px; color: #374151; font-size: 14px;">&#8226;&ensp;Sign up through your organization&#8217;s website</td>
                </tr>
              </table>
              <p style="margin: 0 0 16px;">If you want to create a new organization on Uplifter, you can get started here:</p>
              <!-- CTA button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="{{signupUrl}}" style="display: inline-block; background-color: #5655ED; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">Create an Organization</a>
                  </td>
                </tr>
              </table>
              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">If you didn&#8217;t request this, you can safely ignore this email.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Sign-in Attempted

Someone tried to sign in with this email address, but we don't have an account associated with {{email}}.

If you're trying to access an organization's platform, you may need to:
- Contact your club or organization administrator to get an invitation
- Sign up through your organization's website

If you want to create a new organization on Uplifter, you can get started here:
{{signupUrl}}

If you didn't request this, you can safely ignore this email.`,
    },
    "subscription-payment-success": {
      subject: "Payment Received - Uplifter Subscription",
      html: wrapInBrandedLayout({
        preheaderText: "Your Uplifter subscription payment of {{amount}} has been processed.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #050D22;">Payment Received</h1>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">Your Uplifter subscription is active</p>
              <p style="margin: 0 0 16px;">Your subscription payment of <strong>{{amount}}</strong> for <strong>{{organizationName}}</strong> has been processed successfully.</p>
              <p style="margin: 0 0 16px;"><strong>Reference:</strong> {{reference}}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">If you have any questions about this charge, please contact support.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Payment Received

Your subscription payment of {{amount}} for {{organizationName}} has been processed successfully.

Reference: {{reference}}

If you have any questions about this charge, please contact support.`,
    },
    "subscription-payment-failed": {
      subject: "Action Required: Payment Failed - Uplifter Subscription",
      html: wrapInBrandedLayout({
        preheaderText:
          "We were unable to process your subscription payment. Please update your payment method.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #dc2626;">Payment Failed</h1>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">Action required to keep your account active</p>
              <p style="margin: 0 0 16px;">We were unable to process the subscription payment for <strong>{{organizationName}}</strong>. We tried all payment methods on file, but none were successful.</p>
              <p style="margin: 0 0 16px;">To avoid any interruption to your service, please update your payment method within <strong>30 days</strong>.</p>
              <!-- Warning box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
                <tr>
                  <td style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0; font-size: 14px; color: #991b1b;">&#9888; If no valid payment method is provided within 30 days, your account will be deactivated and your site will go offline.</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px;">You can update your payment method by logging into your admin dashboard and navigating to Settings &gt; Billing.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">If you believe this is an error, please contact support.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Payment Failed - Action Required

We were unable to process the subscription payment for {{organizationName}}. We tried all payment methods on file, but none were successful.

To avoid any interruption to your service, please update your payment method within 30 days.

WARNING: If no valid payment method is provided within 30 days, your account will be deactivated and your site will go offline.

You can update your payment method by logging into your admin dashboard and navigating to Settings > Billing.

If you believe this is an error, please contact support.`,
    },
    "subscription-deactivation-warning": {
      subject: "Urgent: Your Uplifter account will be deactivated in {{daysRemaining}} days",
      html: wrapInBrandedLayout({
        preheaderText:
          "Your Uplifter account will be deactivated in {{daysRemaining}} days due to a failed payment.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #dc2626;">Account Deactivation Warning</h1>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">{{daysRemaining}} days remaining</p>
              <p style="margin: 0 0 16px;">Your <strong>{{organizationName}}</strong> account on Uplifter will be <strong>deactivated in {{daysRemaining}} days</strong> due to an unpaid subscription invoice.</p>
              <p style="margin: 0 0 16px;">When your account is deactivated:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px;">
                <tr><td style="padding: 4px 0 4px 16px; color: #374151; font-size: 14px;">&#8226;&ensp;Your public site will go offline</td></tr>
                <tr><td style="padding: 4px 0 4px 16px; color: #374151; font-size: 14px;">&#8226;&ensp;Admin dashboard access will be suspended</td></tr>
                <tr><td style="padding: 4px 0 4px 16px; color: #374151; font-size: 14px;">&#8226;&ensp;No data will be deleted &mdash; you can reactivate at any time</td></tr>
              </table>
              <p style="margin: 0 0 16px;"><strong>To prevent deactivation</strong>, log in to your admin dashboard and add or update a payment method under Settings &gt; Billing.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">Need help? Contact our support team.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Account Deactivation Warning - {{daysRemaining}} days remaining

Your {{organizationName}} account on Uplifter will be deactivated in {{daysRemaining}} days due to an unpaid subscription invoice.

When your account is deactivated:
- Your public site will go offline
- Admin dashboard access will be suspended
- No data will be deleted -- you can reactivate at any time

To prevent deactivation, log in to your admin dashboard and add or update a payment method under Settings > Billing.

Need help? Contact our support team.`,
    },
    "subscription-deactivated": {
      subject: "Your Uplifter account has been deactivated",
      html: wrapInBrandedLayout({
        preheaderText:
          "Your Uplifter account has been deactivated due to non-payment. Add a payment method to reactivate.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #dc2626;">Account Deactivated</h1>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">Your site is now offline</p>
              <p style="margin: 0 0 16px;">Your <strong>{{organizationName}}</strong> account on Uplifter has been deactivated due to non-payment.</p>
              <p style="margin: 0 0 16px;">Your public site is now offline and admin dashboard access has been suspended. <strong>No data has been deleted.</strong></p>
              <p style="margin: 0 0 16px;"><strong>To reactivate your account</strong>, simply add a valid payment method. Your outstanding balance will be charged and your account will be reactivated immediately.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">Need help? Contact our support team.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Account Deactivated

Your {{organizationName}} account on Uplifter has been deactivated due to non-payment.

Your public site is now offline and admin dashboard access has been suspended. No data has been deleted.

To reactivate your account, simply add a valid payment method. Your outstanding balance will be charged and your account will be reactivated immediately.

Need help? Contact our support team.`,
    },
    "holiday-reminder": {
      subject: "Upcoming Holiday Closure: {{holidayName}} on {{holidayDate}}",
      html: wrapInBrandedLayout({
        preheaderText:
          "{{organizationName}} will be closed on {{holidayDate}} for {{holidayName}}. Programs will not have sessions on this date.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #1f2937;">Upcoming Holiday Closure</h1>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">One week reminder</p>
              <p style="margin: 0 0 16px;">This is a reminder that <strong>{{organizationName}}</strong> will be closed on <strong>{{holidayDate}}</strong> for <strong>{{holidayName}}</strong>.</p>
              <p style="margin: 0 0 16px;">Programs will <strong>not</strong> have sessions scheduled on this date. If you need to override this for specific programs, you can do so from the <strong>Holidays</strong> management page in your dashboard.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">You are receiving this email because you are an administrator of {{organizationName}}.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Upcoming Holiday Closure

This is a reminder that {{organizationName}} will be closed on {{holidayDate}} for {{holidayName}}.

Programs will not have sessions scheduled on this date. If you need to override this for specific programs, you can do so from the Holidays management page in your dashboard.

You are receiving this email because you are an administrator of {{organizationName}}.`,
    },
    "payment-method-expiring": {
      subject: "Action Required: Your payment method is expiring soon",
      html: wrapInBrandedLayout({
        preheaderText:
          "The payment method on file for {{organizationName}} expires {{expiryDate}}. Update it to avoid billing interruptions.",
        bodyHtml: `
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #b45309;">Payment Method Expiring Soon</h1>
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">Update your card to avoid service interruption</p>
              <p style="margin: 0 0 16px;">The {{cardBrand}} card ending in <strong>{{cardLast4}}</strong> on file for <strong>{{organizationName}}</strong> expires <strong>{{expiryDate}}</strong>.</p>
              <p style="margin: 0 0 16px;">Please update your payment method before it expires to ensure uninterrupted service. You can do this from the <strong>Billing</strong> section of your dashboard.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top: 1px solid #e5e7eb; padding: 0; height: 1px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 20px 0 0;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">You are receiving this email because you are an administrator of {{organizationName}}.</p>
                  </td>
                </tr>
              </table>
        `,
      }),
      text: `Payment Method Expiring Soon

The {{cardBrand}} card ending in {{cardLast4}} on file for {{organizationName}} expires {{expiryDate}}.

Please update your payment method before it expires to ensure uninterrupted service. You can do this from the Billing section of your dashboard.

You are receiving this email because you are an administrator of {{organizationName}}.`,
    },
  };

  const templateContent = templates[template];

  return {
    subject: render(templateContent.subject),
    html: render(templateContent.html),
    text: render(templateContent.text),
  };
}

/**
 * Check if email service is configured and working
 */
export async function checkEmailService(): Promise<{
  status: "ok" | "degraded" | "error";
  message: string;
}> {
  const config = getSESConfig();
  const currentEnv = getCurrentEnvironment();

  if (currentEnv === "local") {
    // In local mode, check if MailHog is running
    try {
      const response = await fetch("http://localhost:8025/api/v1/events");
      if (response.ok) {
        return { status: "ok", message: "MailHog is running" };
      }
    } catch {
      return { status: "degraded", message: "MailHog not running - emails will fail" };
    }
  }

  // For cloud environments, check SES configuration
  if (!process.env.AWS_SES_REGION) {
    return { status: "degraded", message: "SES not configured" };
  }

  return {
    status: "ok",
    message: `SES configured (${config.mode} mode)`,
  };
}
