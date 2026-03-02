/**
 * Email Service
 * 
 * This module provides a unified interface for sending emails that works with:
 * - Amazon SES in cloud environments (production, staging, development)
 * - MailHog in local development via SMTP (catches all emails for inspection)
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getSESConfig } from './services-config';
import { getCurrentEnvironment } from './env-domains';
import { logger } from './logger';

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
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
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

  const smtpHost = process.env.SMTP_HOST || 'localhost';
  const smtpPort = parseInt(process.env.SMTP_PORT || '1025', 10);

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
  if (currentEnv === 'local') {
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

  logger.info('[EMAIL] Sending email via SMTP/MailHog', {
    to: options.to,
    from: fromAddress,
    subject: options.subject,
  });

  try {
    const result = await transporter.sendMail({
      from: fromAddress,
      to: options.to.join(', '),
      cc: options.cc?.join(', '),
      bcc: options.bcc?.join(', '),
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info('[EMAIL] Email sent successfully via SMTP', {
      messageId: result.messageId,
      to: options.to,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error: any) {
    logger.error('[EMAIL] Failed to send email via SMTP', {
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
  if (config.mode === 'sandbox') {
    logger.warn('[EMAIL] SES is in sandbox mode - recipients must be verified', {
      to: options.to,
    });
  }

  if (config.configurationSetName) {
    logger.info('[EMAIL] Using SES Configuration Set', {
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
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: options.html,
            Charset: 'UTF-8',
          },
          ...(options.text && {
            Text: {
              Data: options.text,
              Charset: 'UTF-8',
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

    logger.info('[EMAIL] Email sent successfully via SES', {
      messageId: response.MessageId,
      to: options.to,
    });

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error: any) {
    logger.error('[EMAIL] Failed to send email via SES', {
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
  | 'welcome'
  | 'password-reset'
  | 'no-account'
  | 'invitation'
  | 'invitation-existing-user'
  | 'registration-confirmation'
  | 'payment-confirmation'
  | 'checkout-receipt'
  | 'announcement'
  | 'feedback-roadmap'
  | 'mfa-code'
  | 'email-login-code';

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
      (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value),
      str
    );
  };

  const templates: Record<EmailTemplate, { subject: string; html: string; text: string }> = {
    'welcome': {
      subject: 'Welcome to {{organizationName}}!',
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
    'password-reset': {
      subject: 'Reset Your Password',
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
    'no-account': {
      subject: 'Password Reset Attempted',
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
    'invitation': {
      subject: 'You\'ve been invited to join {{organizationName}}',
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
    'invitation-existing-user': {
      subject: '{{inviterName}} invited you to join {{organizationName}}',
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
    'registration-confirmation': {
      subject: 'Registration Confirmed - {{eventName}}',
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
    'payment-confirmation': {
      subject: 'Payment Confirmation - {{amount}}',
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
    'checkout-receipt': {
      subject: 'Order Confirmation - {{reference}}',
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

        Total: {{total}}

        View your receipt: {{receiptUrl}}

        Thank you!
      `,
    },
    'announcement': {
      subject: '{{subject}}',
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
    'feedback-roadmap': {
      subject: 'Your feedback has been added to the Uplifter roadmap!',
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
    'mfa-code': {
      subject: 'Your verification code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1f2937;">Verification Required</h1>
          <p>Hello {{name}},</p>
          <p>We noticed it&rsquo;s been a while since your last sign-in. To keep your account secure, please verify your identity using the code below:</p>
          <div style="margin: 24px 0; text-align: center;">
            <span style="display: inline-block; font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; background-color: #f3f4f6; padding: 16px 24px; border-radius: 8px; border: 1px solid #e5e7eb;">{{code}}</span>
          </div>
          <p style="text-align: center;">Or click the button below to verify directly:</p>
          <p style="margin: 24px 0; text-align: center;">
            <a href="{{verifyUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify and Sign In</a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This code expires in {{expiresIn}}.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">If you didn&rsquo;t attempt to sign in, someone may have your password. We recommend resetting it immediately.</p>
        </div>
      `,
      text: `
        Verification Required
        
        Hello {{name}},
        
        We noticed it's been a while since your last sign-in. To keep your account secure, please verify your identity using the code below:
        
        {{code}}
        
        Or verify directly: {{verifyUrl}}
        
        This code expires in {{expiresIn}}.
        
        If you didn't attempt to sign in, someone may have your password. We recommend resetting it immediately.
      `,
    },
    'email-login-code': {
      subject: 'Your sign-in code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1f2937;">Sign In to Uplifter</h1>
          <p>Hello,</p>
          <p>Use the code below to sign in to your account:</p>
          <div style="margin: 24px 0; text-align: center;">
            <span style="display: inline-block; font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; background-color: #f3f4f6; padding: 16px 24px; border-radius: 8px; border: 1px solid #e5e7eb;">{{code}}</span>
          </div>
          <p style="text-align: center;">Or click the button below to sign in directly:</p>
          <p style="margin: 24px 0; text-align: center;">
            <a href="{{verifyUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign In</a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This code expires in {{expiresIn}}.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">If you didn&rsquo;t request this code, you can safely ignore this email.</p>
        </div>
      `,
      text: `
        Sign In to Uplifter
        
        Hello,
        
        Use the code below to sign in to your account:
        
        {{code}}
        
        Or sign in directly: {{verifyUrl}}
        
        This code expires in {{expiresIn}}.
        
        If you didn't request this code, you can safely ignore this email.
      `,
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
export async function checkEmailService(): Promise<{ status: 'ok' | 'degraded' | 'error'; message: string }> {
  const config = getSESConfig();
  const currentEnv = getCurrentEnvironment();

  if (currentEnv === 'local') {
    // In local mode, check if MailHog is running
    try {
      const response = await fetch('http://localhost:8025/api/v1/events');
      if (response.ok) {
        return { status: 'ok', message: 'MailHog is running' };
      }
    } catch {
      return { status: 'degraded', message: 'MailHog not running - emails will fail' };
    }
  }

  // For cloud environments, check SES configuration
  if (!process.env.AWS_SES_REGION) {
    return { status: 'degraded', message: 'SES not configured' };
  }

  return { 
    status: 'ok', 
    message: `SES configured (${config.mode} mode)` 
  };
}
