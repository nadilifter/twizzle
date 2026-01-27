# Email Integration with AWS SES

This document outlines the steps to integrate email notifications for the Uplifter platform using AWS Simple Email Service (SES).

## Overview

When a user completes a checkout or registers for a program, the system should send transactional emails (receipts, welcome emails). We currently have placeholders for these actions.

## Prerequisites

1.  **AWS Account**: An active AWS account.
2.  **Domain Verification**: The domain (e.g., `uplifterinc.com` or club domains) must be verified in AWS SES.
3.  **SES Credentials**: Access Key ID and Secret Access Key with `ses:SendEmail` permissions.

## Implementation Plan

### 1. Setup AWS SDK

Install the AWS SDK for JavaScript V3:

```bash
npm install @aws-sdk/client-ses
```

### 2. Configure SES Client

Create a service file `src/lib/email.ts`:

```typescript
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  const command = new SendEmailCommand({
    Destination: { ToAddresses: [to] },
    Message: {
      Body: {
        Html: { Charset: "UTF-8", Data: html },
        Text: { Charset: "UTF-8", Data: text || "" },
      },
      Subject: { Charset: "UTF-8", Data: subject },
    },
    Source: process.env.EMAIL_FROM || "noreply@uplifterinc.com",
  });

  try {
    return await sesClient.send(command);
  } catch (error) {
    console.error("Failed to send email:", error);
    // Don't throw in production to avoid breaking the checkout flow
    // but consider queueing for retry
  }
}
```

### 3. Create Email Templates

Use a library like `@react-email/components` to build responsive HTML emails using React components, or use simple HTML templates.

Suggested templates:
-   `src/emails/receipt.tsx`: Order confirmation with invoice details.
-   `src/emails/welcome.tsx`: Welcome message for new users.

### 4. Trigger Emails

**Checkout Success**:
In the Adyen Webhook handler (`src/app/api/webhooks/adyen/route.ts` - to be implemented) or the Receipt page (less reliable), trigger the email.

```typescript
// Example inside webhook handler
if (event.eventCode === 'AUTHORISATION' && event.success === 'true') {
  const invoice = await db.invoice.findUnique({...});
  await sendEmail({
    to: invoice.family.email,
    subject: `Receipt for Order ${invoice.reference}`,
    html: renderReceiptEmail(invoice),
  });
}
```

### 5. Environment Variables

Add the following to `.env`:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
EMAIL_FROM=noreply@uplifterinc.com
```

## Next Steps

1.  Implement `src/lib/email.ts`.
2.  Design the Receipt Email template.
3.  Hook into the payment success flow (Webhook recommended).
