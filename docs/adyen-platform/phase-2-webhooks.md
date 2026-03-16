# Phase 2: Balance Platform Webhook Handler

**Type**: Backend (new webhook route + extend existing route)
**Depends on**: Phase 1 (AdyenPlatformAccount model must exist)
**Blocks**: Phase 3 (onboarding depends on receiving status webhooks)
**Estimated effort**: 1-2 days
**Risk to existing functionality**: Low -- adds a new route and extends existing webhook with additional event handling

## Overview

Create a single webhook route for ALL Adyen balance platform events, and extend the existing payment webhook to handle additional event codes (REFUND, CHARGEBACK, etc.). This must be deployed before onboarding any clubs, because onboarding status updates arrive via these webhooks.

## Adyen Prerequisite

Three balance platform webhook subscriptions must be configured in the Adyen Customer Area (Phase 0, Step 0.5), all pointing to `/api/webhooks/adyen-balance-platform`:
1. **Configuration webhook** (account holder events)
2. **Transfer webhook** (transfer events)
3. **Negative Balance Compensation Warning** webhook

Each generates its own HMAC key. All three must be set in `.env`:
- `ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY`
- `ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY`
- `ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY`

---

## Step 2A: Create Balance Platform Webhook Route

### File to create: `src/app/api/webhooks/adyen-balance-platform/route.ts`

This is a single route that handles ALL balance platform event types, dispatching based on the `type` field.

### Balance platform webhook payload format

Balance platform webhooks have a DIFFERENT format from standard payment webhooks. Standard payment webhooks use `notificationItems[].NotificationRequestItem`. Balance platform webhooks use a flat structure:

```json
{
  "data": {
    "accountHolder": { ... },
    "balancePlatform": "YOUR_BALANCE_PLATFORM",
    ...
  },
  "environment": "test",
  "type": "balancePlatform.accountHolder.updated"
}
```

### Event types to handle

#### Configuration events (onboarding status)

**`balancePlatform.accountHolder.created`**
- Look up `AdyenPlatformAccount` by `data.accountHolder.id` (matching `accountHolderId`)
- Confirm creation, log success
- No status change needed (already `PENDING_HOSTED` from Phase 3)

**`balancePlatform.accountHolder.updated`**
- Look up `AdyenPlatformAccount` by `data.accountHolder.id`
- Extract `capabilities` from `data.accountHolder.capabilities`
- Store raw capabilities JSON in `AdyenPlatformAccount.capabilities`
- Determine `onboardingStatus` from capability states:
  - If all requested capabilities have `allowed: true` → `VERIFIED`
  - If any capability has `verificationStatus: "pending"` → `IN_REVIEW`
  - If any capability has `allowed: false` with problems → `AWAITING_DATA` or `REJECTED`
  - If `problems` array exists with actionable items → `AWAITING_DATA`
- Update `verificationStatus` with a human-readable summary string

**`balancePlatform.balanceAccount.created`** / **`balancePlatform.balanceAccount.updated`**
- Log the event
- If the balance account matches an org's `AdyenPlatformAccount.balanceAccountId`, update if needed

#### Transfer events (payment tracking)

**`balancePlatform.transfer.created`** / **`balancePlatform.transfer.updated`**
- These represent all money movements: captures, refunds, chargebacks, sweeps, bank transfers
- Extract: `data.transfer.id`, `data.transfer.category`, `data.transfer.status`, `data.transfer.amount`
- Map `category` to internal tracking:
  - `"bank"` → sweep/payout to bank account
  - `"platformPayment"` → payment capture split
  - `"internalTransfer"` → inter-account transfer
  - etc.
- For `"bank"` category transfers: create or update `Payout` record
- For other categories: log for now (detailed handling in Phase 8)

#### Negative balance events

**`balancePlatform.negativeBalanceCompensationWarning.scheduled`**
- Extract `data.balanceAccountId` and match to organization
- Log a warning
- (Phase 7 will add: store negative balance state, trigger notifications)

### HMAC Signature Verification

Adyen has three separate webhook subscriptions (Configuration, Transfer, Negative Balance) each with its own HMAC key, all pointing to the same endpoint. The handler must try all three keys to verify.

The HMAC is computed over the entire raw body:

```typescript
import crypto from "crypto"

const BP_HMAC_KEYS = [
  process.env.ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY,
  process.env.ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY,
  process.env.ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY,
].filter(Boolean) as string[]

function verifyBalancePlatformHmac(rawBody: string, signature: string): boolean {
  for (const hmacKey of BP_HMAC_KEYS) {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", Buffer.from(hmacKey, "hex"))
        .update(rawBody, "utf-8")
        .digest("base64")

      if (crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )) {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}
```

### Response format

Always return `{ "notificationResponse": "[accepted]" }` with HTTP 200, even on processing errors (to prevent Adyen from retrying endlessly). Log errors internally.

### Implementation skeleton

```typescript
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  const body = await request.text()

  // Verify HMAC signature
  const hmacSignature = request.headers.get("hmacsignature") || ""
  // ... verify using verifyBalancePlatformHmac() with all three HMAC keys

  const event = JSON.parse(body)
  const eventType = event.type as string

  logger.info("[WEBHOOK] Balance platform event received", { type: eventType })

  switch (eventType) {
    case "balancePlatform.accountHolder.created":
      await handleAccountHolderCreated(event.data)
      break
    case "balancePlatform.accountHolder.updated":
      await handleAccountHolderUpdated(event.data)
      break
    case "balancePlatform.transfer.created":
    case "balancePlatform.transfer.updated":
      await handleTransferEvent(event.data, eventType)
      break
    case "balancePlatform.negativeBalanceCompensationWarning.scheduled":
      await handleNegativeBalanceWarning(event.data)
      break
    default:
      logger.info("[WEBHOOK] Unhandled balance platform event", { type: eventType })
  }

  return NextResponse.json({ notificationResponse: "[accepted]" })
}
```

---

## Step 2B: Extend Existing Payment Webhook

### File to modify: `src/app/api/webhooks/adyen/route.ts`

The current webhook only handles `AUTHORISATION`. Add handlers for these additional event codes:

**`CAPTURE`** (payment captured):
- Look up `Transaction` by `pspReference`
- Update `status` to `CAPTURED` if currently `AUTHORISED`

**`REFUND`** (refund completed):
- Look up original `Transaction` by `originalReference` (from the notification's `additionalData`)
- Create a new `Transaction` with type `REFUND` and negative amount
- Look up associated `Invoice` and update status to `REFUNDED` if fully refunded

**`CHARGEBACK`** (chargeback received):
- Create a `Transaction` with type `CHARGEBACK` and negative amount
- Look up associated `Invoice` and log the chargeback

**`REFUND_FAILED`** / **`CAPTURE_FAILED`**:
- Log the failure with full details
- Update relevant `Transaction` status to `ERROR`

### Where to add in existing code

In the `POST` function, after the existing AUTHORISATION handling (line 55-61 in current code), add:

```typescript
// After existing AUTHORISATION handling...

if (eventCode === "CAPTURE" && (success === "true" || success === true)) {
  await handleCapture(pspReference)
}

if (eventCode === "REFUND" && (success === "true" || success === true)) {
  await handleRefund(notificationItem)
}

if (eventCode === "CHARGEBACK") {
  await handleChargeback(notificationItem)
}

if (eventCode === "REFUND_FAILED" || eventCode === "CAPTURE_FAILED") {
  await handleFailure(eventCode, notificationItem)
}
```

Implement each handler as a separate async function in the same file, following the pattern of the existing `handleAuthorisation` function.

---

## Step 2C: Register New Webhook Endpoint

### File to modify: `src/lib/webhooks.ts`

Add to `WEBHOOK_ENDPOINTS` (line 32-47):

```typescript
/** Adyen balance platform webhook endpoint */
adyenBalancePlatform: () => `${getWebhookBaseUrl()}/api/webhooks/adyen-balance-platform`,
```

Add to `getWebhookSetupInstructions()` (after the existing `adyen` entry):

```typescript
adyenBalancePlatform: {
  url: WEBHOOK_ENDPOINTS.adyenBalancePlatform(),
  instructions: `
1. Go to Adyen Customer Area (${currentEnv === 'production' ? 'ca-live' : 'ca-test'}.adyen.com)
2. Navigate to Developers > Webhooks
3. Create a new "Balance Platform" webhook
4. Set URL: ${WEBHOOK_ENDPOINTS.adyenBalancePlatform()}
5. Subscribe to: accountHolder, transfer, and negativeBalanceCompensationWarning events
6. Enable HMAC verification
7. Copy the HMAC keys to ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY, ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY, ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY
  `.trim(),
},
```

### File to modify: `src/lib/services-config.ts`

Add to the `WEBHOOK_ENDPOINTS` object (line 150-155):

```typescript
adyenBalancePlatform: () => `${getWebhookBaseUrl()}/api/webhooks/adyen-balance-platform`,
```

---

## Verification

1. **Deploy to staging** (or use ngrok for local testing)
2. **Send a test webhook** from Adyen Customer Area > Developers > Webhooks > Test
3. Verify the balance platform webhook is received and logged
4. Verify HMAC signature verification works (reject invalid signatures)
5. Verify the existing payment webhook still works for AUTHORISATION events
6. **No changes needed to existing payment flow** -- this phase only adds new endpoints and extends the existing one
