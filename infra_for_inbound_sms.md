# Inbound Email Setup for Chat Replies

**Domain:** `chat.uplifterinc.com` (production) / `chat.uplifterdev.com` (staging)

## 1. DNS — MX record

```
chat.uplifterinc.com.    MX    10    inbound-smtp.us-east-1.amazonaws.com.
```

## 2. SES — Verify domain

Verify `chat.uplifterinc.com` in SES (us-east-1). If `uplifterinc.com` already has DKIM set up, the subdomain inherits it — just confirm it shows as verified.

## 3. SNS — Create topic

- Create SNS topic `ses-inbound-chat` in us-east-1
- Add an HTTPS subscription: `https://uplifterinc.com/api/ses/inbound`
- The app auto-confirms the subscription on first delivery

## 4. SES — Receipt rule

- Ensure a receipt rule set is active in SES (us-east-1)
- Create a receipt rule:
  - **Recipient:** `chat.uplifterinc.com`
  - **Action:** SNS → topic `ses-inbound-chat`, encoding UTF-8

## 5. Environment variables

```
SES_INBOUND_DOMAIN=chat.uplifterinc.com
SES_INBOUND_SNS_TOPIC_ARN=arn:aws:sns:us-east-1:<account-id>:ses-inbound-chat
CHAT_EMAIL_HMAC_SECRET=<generate a random 32+ char secret>
```

## 6. Deploy and verify

After deploy, send a test email to `chat+test.anything@chat.uplifterinc.com`. The app logs should show `[SES INBOUND]` entries — a "No conversation ID found" or HMAC failure log confirms the full pipeline is working end-to-end. Then test with an actual `WEB_EMAIL` conversation to verify a real reply routes correctly.
