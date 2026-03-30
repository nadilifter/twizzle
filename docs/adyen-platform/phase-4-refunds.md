# Phase 4: Refunds

**Type**: Backend (new API route + API client addition)
**Depends on**: Phase 3 (need completed payments to refund; refunds also work for non-onboarded orgs)
**Blocks**: Phase 6 (negative balance handling relates to refund scenarios)
**Estimated effort**: 1-2 days
**Risk to existing functionality**: Low -- new API endpoint, no modification to existing flows

## Overview

Implement a refund API endpoint that calls Adyen's refund API. The Phase 2 webhook handler already handles `REFUND` event codes.

## Adyen Prerequisites

- Completed test payments (need `pspReference` values to refund)
- No additional API credentials needed (uses existing Checkout API key)

---

## Step 4A: Add Refund Function to API Client

### File to modify: `src/lib/adyen-platform.ts`

Add this function:

```typescript
export async function refundPayment(
  pspReference: string,
  amount: { value: number; currency: string },
  merchantAccount?: string,
  reference?: string
): Promise<{ pspReference: string; status: string; [key: string]: any }>;
```

**Implementation**:

```typescript
export async function refundPayment(
  pspReference: string,
  amount: { value: number; currency: string },
  merchantAccount?: string,
  reference?: string
) {
  try {
    // Use the Checkout API's modifications endpoint
    const { CheckoutAPI } = require("@adyen/api-library");
    const checkoutApi = new CheckoutAPI(getPlatformClient());

    const response = await checkoutApi.ModificationsApi.refundCapturedPayment(pspReference, {
      amount,
      merchantAccount: merchantAccount || process.env.ADYEN_MERCHANT_ACCOUNT || "TestMerchant",
      reference: reference || `refund-${pspReference}-${Date.now()}`,
    });

    return response;
  } catch (error) {
    console.error("Error refunding payment:", error);
    throw error;
  }
}
```

---

## Step 4B: Create Refund API Endpoint

### File to create: `src/app/api/transactions/[id]/refund/route.ts`

### POST -- Process a Refund

**Auth**: Requires authenticated session with `financials.create` permission or admin (`*`).

**Request body**:

```typescript
{
  amount?: number;  // Optional: partial refund amount in dollars. If omitted, full refund.
  reason?: string;  // Optional: reason for refund
}
```

**Flow**:

1. Look up the `Transaction` by ID (from URL param)
2. Verify the transaction belongs to the current organization
3. Verify the transaction type is `PAYMENT` and status is `SETTLED` or `CAPTURED`
4. Calculate refund amount:
   - If `amount` provided: use it (partial refund). Validate it doesn't exceed original amount.
   - If not provided: use original transaction amount (full refund)
5. Use `ADYEN_MERCHANT_ACCOUNT` for the refund call
6. Call `refundPayment()` with the transaction's `pspReference`
7. Create a new `Transaction` record:
   ```typescript
   await db.transaction.create({
     data: {
       organizationId: transaction.organizationId,
       pspReference: response.pspReference,
       merchantRef: transaction.merchantRef,
       type: "REFUND",
       amount: -refundAmount, // Negative to indicate money going out
       currency: transaction.currency,
       status: "PENDING", // Will be updated to SETTLED when webhook arrives
       method: transaction.method,
       description: `Refund – ${transaction.merchantRef}${reason ? ` (${reason})` : ""}`,
       metadata: { originalPspReference: transaction.pspReference, reason },
     },
   });
   ```
8. If full refund and there's an associated invoice, update invoice status:
   ```typescript
   if (isFullRefund && transaction.paymentId) {
     const payment = await db.payment.findUnique({ where: { id: transaction.paymentId } });
     if (payment?.invoiceId) {
       await db.payment.update({
         where: { id: payment.id },
         data: { status: "REFUNDED" },
       });
       await db.invoice.update({
         where: { id: payment.invoiceId },
         data: { status: "CANCELLED" },
       });
     }
   }
   ```

**Error handling**:

- If Adyen returns an error, return the error to the caller
- Do not create a Transaction record if the Adyen call fails

**Response**: Return the new refund transaction record.

---

## Step 4C: Verify Phase 2 Webhook Handles Refund Events

The existing payment webhook (`src/app/api/webhooks/adyen/route.ts`) was extended in Phase 2B to handle `REFUND` event codes. Verify that when a refund completes:

1. The `REFUND` webhook arrives with the refund's `pspReference`
2. The handler updates the refund `Transaction` status from `PENDING` to `SETTLED`
3. The `originalReference` in the webhook payload matches the original payment's `pspReference`

If the Phase 2B implementation only logs refund events without updating records, enhance it now:

```typescript
async function handleRefund(notificationItem: any) {
  const { pspReference, success } = notificationItem;

  if (success !== "true" && success !== true) {
    logger.warn("Refund failed", { pspReference });
    return;
  }

  // Update the refund transaction status
  await db.transaction.updateMany({
    where: { pspReference, type: "REFUND" },
    data: { status: "SETTLED", settledAt: new Date() },
  });
}
```

---

## Verification / Test Plan

1. **Full refund**:
   - Process a payment via the existing checkout flow
   - Call `POST /api/transactions/{id}/refund` with no body (full refund)
   - Verify refund Transaction record created with status `PENDING`
   - Verify Adyen Customer Area shows the refund
   - Verify `REFUND` webhook updates status to `SETTLED`
   - Verify invoice status updated to `CANCELLED`

2. **Partial refund**:
   - Process a payment
   - Call refund endpoint with `{ "amount": 5.00 }`
   - Verify partial refund amount is correct
   - Verify invoice status is NOT changed (partial refund doesn't cancel)

3. **Double refund prevention**:
   - Try to refund the same transaction twice (full amount both times)
   - Second attempt should fail or be prevented by checking existing refund records
