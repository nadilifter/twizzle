# Phase 5: Recurring Charge Execution

**Type**: Backend (new service + modify existing route)
**Depends on**: Phase 3 (onboarding must exist; recurring also works for non-onboarded orgs)
**Blocks**: Nothing directly
**Estimated effort**: 2-3 days
**Risk to existing functionality**: MEDIUM -- modifies the recurring charge batch runner, which is currently a placeholder

## Overview

The recurring charge batch runner at `src/app/api/recurring/route.ts` is currently a placeholder that updates dates but does NOT actually call Adyen to charge cards. This phase implements the actual payment execution.

The current code (lines 288-315) contains this comment:

```
// In a real implementation, you would:
// 1. Create a payment intent with Adyen
// 2. Process the payment
// 3. Create an invoice and payment record
// 4. Update the recurring charge
```

## Adyen Prerequisites

- Stored payment tokens exist (via `PaymentMethod` model for guardians, or `OrganizationPaymentMethod` for org subscriptions)
- No additional API credentials needed

---

## Step 5A: Create Recurring Billing Service

### File to create: `src/lib/recurring-billing-service.ts`

This service encapsulates the logic of charging a single recurring charge via Adyen.

### Function: `executeRecurringCharge`

```typescript
interface ChargeResult {
  success: boolean;
  pspReference?: string;
  error?: string;
  invoiceId?: string;
  transactionId?: string;
}

export async function executeRecurringCharge(
  charge: RecurringChargeWithRelations,
  organizationId: string
): Promise<ChargeResult>;
```

**Where `RecurringChargeWithRelations` includes**:

```typescript
{
  id: string;
  organizationId: string;
  userId: string | null;
  athleteId: string | null;
  description: string;
  amount: Decimal;
  frequency: string;
  paymentMethodId: string | null;
  paymentMethod: { id: string; type: string; last4: string; brand: string | null } | null;
}
```

**Flow**:

1. **Validate**: Ensure `paymentMethodId` and `paymentMethod` exist. Return `{ success: false, error: "No payment method" }` if missing.

2. **Look up stored token**: The `PaymentMethod` model stores card info but does NOT currently store Adyen's `storedPaymentMethodId`. This is a gap:
   - Current `PaymentMethod` has: `id`, `userId`, `type`, `last4`, `expiry`, `brand`, `isDefault`
   - Missing: `storedPaymentMethodId` (the Adyen token reference), `shopperReference`
   - **Schema addition needed**: Add `adyenTokenId` (String, optional) and `shopperReference` (String, optional) to the `PaymentMethod` model

3. **Build payment request**:

   ```typescript
   const paymentRequest: any = {
     amount: { currency: "USD", value: Math.round(Number(charge.amount) * 100) },
     reference: `recurring-${charge.id}-${Date.now()}`,
     merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
     shopperReference: paymentMethod.shopperReference,
     paymentMethod: {
       type: "scheme",
       storedPaymentMethodId: paymentMethod.adyenTokenId,
     },
     shopperInteraction: "ContAuth",
     recurringProcessingModel: "Subscription",
   };
   ```

4. **Add Idempotency-Key**: For `/payments` calls (unlike `/sessions`), idempotency keys are important:

   ```typescript
   // The idempotency key ensures retries don't create duplicate charges
   const idempotencyKey = `recurring-${charge.id}-${charge.nextChargeDate.toISOString().split("T")[0]}`;
   ```

5. **Call Adyen**:

   ```typescript
   const response = await checkoutApi.PaymentsApi.payments(paymentRequest, {
     idempotencyKey,
   });
   ```

6. **Create records on success** (`resultCode === "Authorised"`):
   - Create `Invoice` with reference `REC-{charge.id}-{timestamp}`
   - Create `LineItem` with charge description and amount
   - Create `Payment` linked to invoice
   - Create `Transaction` with pspReference
   - Update invoice status to `PAID`

7. **Handle failure**:
   - If `resultCode` is `Refused`, `Error`, etc.: return `{ success: false, error: response.refusalReason }`
   - The caller (batch runner) handles incrementing `failureCount`

---

## Step 5B: Schema Addition for PaymentMethod

### File to modify: `prisma/schema.prisma`

Add Adyen token fields to the existing `PaymentMethod` model (around line 679):

```prisma
model PaymentMethod {
  id        String            @id @default(cuid())
  userId    String?
  type      PaymentMethodType
  last4     String
  expiry    String?
  brand     String?
  isDefault Boolean           @default(false)
  createdAt DateTime          @default(now())

  // Adyen stored payment method token
  adyenTokenId     String?  @unique
  shopperReference String?

  // Relations
  user             User?             @relation("UserPaymentMethods", fields: [userId], references: [id], onDelete: Cascade)
  recurringCharges RecurringCharge[]

  @@index([userId])
  @@index([adyenTokenId])
}
```

Run migration: `pnpm db:migrate` (migration name: `add_adyen_token_to_payment_method`)

---

## Step 5C: Update Batch Runner Route

### File to modify: `src/app/api/recurring/route.ts`

Replace the placeholder logic in the PATCH handler (lines 288-315) with actual Adyen calls:

```typescript
for (const charge of dueCharges) {
  if (!charge.paymentMethodId || !charge.paymentMethod) {
    results.skipped++;
    continue;
  }

  // Skip if no Adyen token is configured
  if (!charge.paymentMethod.adyenTokenId) {
    results.skipped++;
    continue;
  }

  try {
    const result = await executeRecurringCharge(charge, charge.organizationId);

    if (result.success) {
      // Calculate next charge date
      const nextDate = new Date(charge.nextChargeDate);
      if (charge.frequency === "MONTHLY") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (charge.frequency === "YEARLY") {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      await db.recurringCharge.update({
        where: { id: charge.id },
        data: {
          nextChargeDate: nextDate,
          lastChargedAt: new Date(),
          failureCount: 0, // Reset on success
        },
      });

      results.processed++;
    } else {
      const newFailureCount = charge.failureCount + 1;
      const MAX_RETRIES = 3;

      await db.recurringCharge.update({
        where: { id: charge.id },
        data: {
          failureCount: newFailureCount,
          status: newFailureCount >= MAX_RETRIES ? "FAILED" : "ACTIVE",
        },
      });

      results.failed++;
    }
  } catch (error) {
    console.error(`Error processing recurring charge ${charge.id}:`, error);
    results.failed++;
  }
}
```

Also update the query to include `paymentMethod` with the new fields:

```typescript
include: {
  paymentMethod: {
    select: {
      id: true,
      type: true,
      last4: true,
      brand: true,
      adyenTokenId: true,
      shopperReference: true,
    },
  },
},
```

---

## Verification / Test Plan

1. **Create a recurring charge with a stored token**:
   - Tokenize a card for a test user (via the existing tokenization flow)
   - Ensure the `PaymentMethod` record has `adyenTokenId` populated
   - Create a `RecurringCharge` pointing to this payment method

2. **Run the batch**:
   - Set `nextChargeDate` to today
   - Call `PATCH /api/recurring` with `{ "action": "run_batch" }`
   - Verify the payment is processed via Adyen
   - Verify Invoice, Payment, Transaction records are created
   - Verify `nextChargeDate` is advanced

3. **Failure handling**:
   - Use an invalid token to trigger a refused payment
   - Verify `failureCount` increments
   - After 3 failures, verify status changes to `FAILED`

4. **Idempotency**:
   - Run the batch twice for the same charge on the same day
   - Verify only one payment is created (idempotency key prevents double-charge)
