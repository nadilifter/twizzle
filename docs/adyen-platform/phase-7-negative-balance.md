# Phase 7: Negative Balance Handling

**Type**: Backend (API client addition + new route + extend webhook handler)
**Depends on**: Phase 5 (negative balances typically arise from refunds or chargebacks)
**Blocks**: Nothing
**Estimated effort**: 1-2 days
**Risk to existing functionality**: None -- new functionality only

## Overview

When a club's Adyen balance account goes negative (e.g., from a refund when funds have already been swept to their bank, or from a chargeback), Adyen schedules a negative balance compensation. This phase implements:

1. Enhanced webhook handling for negative balance warnings
2. A transfer API to top up a negative balance account
3. Superadmin tools to manage negative balances

## Adyen Prerequisites

- The `receiveFromBalanceAccount` capability must be enabled on account holders (requested during Phase 3A onboarding)
- Transfers API access in the API key (configured in Phase 0.2)

---

## Step 7A: Enhance Negative Balance Webhook Handling

### File to modify: `src/app/api/webhooks/adyen-balance-platform/route.ts`

The Phase 2 handler logs `balancePlatform.negativeBalanceCompensationWarning.scheduled` events. Enhance it to:

1. **Add fields to `AdyenPlatformAccount`** (schema change):
   ```prisma
   // Add to AdyenPlatformAccount model
   hasNegativeBalance        Boolean   @default(false)
   negativeBalanceAmount     Decimal?  @db.Decimal(10, 2)
   negativeBalanceWarningAt  DateTime?
   ```

   Run migration: `pnpm db:migrate` (name: `add_negative_balance_fields`)

2. **Update the webhook handler**:
   ```typescript
   async function handleNegativeBalanceWarning(data: any) {
     const balanceAccountId = data.balanceAccountId || data.balancePlatform?.balanceAccountId;

     const platformAccount = await db.adyenPlatformAccount.findFirst({
       where: { balanceAccountId },
       include: { organization: { select: { id: true, name: true } } },
     });

     if (!platformAccount) {
       logger.warn("[WEBHOOK] Negative balance warning for unknown balance account", { balanceAccountId });
       return;
     }

     // Extract amount from the event data
     const amount = data.amount?.value ? data.amount.value / 100 : null;

     await db.adyenPlatformAccount.update({
       where: { id: platformAccount.id },
       data: {
         hasNegativeBalance: true,
         negativeBalanceAmount: amount,
         negativeBalanceWarningAt: new Date(),
       },
     });

     logger.warn("[WEBHOOK] Negative balance compensation scheduled", {
       organizationId: platformAccount.organizationId,
       organizationName: platformAccount.organization.name,
       balanceAccountId,
       amount,
     });

     // TODO: Send notification to superadmin (email or in-app alert)
   }
   ```

3. **Clear negative balance when a top-up resolves it**:
   In the `balancePlatform.transfer.updated` handler, check if the transfer is an incoming transfer to a previously-negative balance account:
   ```typescript
   if (transfer.category === "topUp" && transfer.status === "transferred") {
     await db.adyenPlatformAccount.updateMany({
       where: { balanceAccountId: transfer.counterparty?.balanceAccountId },
       data: { hasNegativeBalance: false, negativeBalanceAmount: null },
     });
   }
   ```

---

## Step 7B: Add Transfer Function to API Client

### File to modify: `src/lib/adyen-platform.ts`

Add transfer function:

```typescript
export async function topUpBalanceAccount(
  sourceBalanceAccountId: string,
  destinationBalanceAccountId: string,
  amount: { value: number; currency: string },
  reference?: string,
): Promise<{ id: string; status: string; [key: string]: any }>
```

**Implementation**:
```typescript
export async function topUpBalanceAccount(
  sourceBalanceAccountId: string,
  destinationBalanceAccountId: string,
  amount: { value: number; currency: string },
  reference?: string,
) {
  try {
    const { TransfersAPI } = require("@adyen/api-library");
    const transfersApi = new TransfersAPI(getPlatformClient());

    const response = await transfersApi.TransfersApi.transferFunds({
      amount,
      counterparty: {
        balanceAccountId: destinationBalanceAccountId,
      },
      balanceAccountId: sourceBalanceAccountId,
      category: "topUp",
      reference: reference || `topup-${destinationBalanceAccountId}-${Date.now()}`,
      description: "Negative balance top-up",
    });

    return response;
  } catch (error) {
    console.error("Error executing balance transfer:", error);
    throw error;
  }
}
```

**Note**: The exact method name on the `TransfersAPI` class may differ. Check the `@adyen/api-library` v30 source for the correct method. It could be `transferFunds`, `makeTransfer`, or `transfers`.

Alternative approach if direct transfers are not available: Use the `POST /transfers` endpoint directly:
```
POST https://balanceplatform-api-test.adyen.com/btl/v4/transfers
{
  "amount": { "value": 1000, "currency": "USD" },
  "balanceAccountId": "<source>",
  "counterparty": { "balanceAccountId": "<destination>" },
  "category": "topUp"
}
```

---

## Step 7C: Create Superadmin Transfer Endpoint

### File to create: `src/app/api/organization/adyen-transfer/route.ts`

### POST -- Trigger a Balance Top-Up

**Auth**: Superadmin only.

**Request body**:
```typescript
{
  organizationId: string;
  amount: number;  // In dollars
}
```

**Flow**:
1. Look up `AdyenPlatformAccount` for the organization
2. Verify account has `balanceAccountId`
3. Get the liable account's balance account ID (from env or config -- this is Kirra's own balance account)
4. Call `topUpBalanceAccount()`:
   - Source: Kirra's liable balance account
   - Destination: Club's balance account
   - Amount: provided amount in minor units
5. Log the transfer
6. Clear `hasNegativeBalance` after successful transfer

**Response**: Return transfer details.

**Note**: This moves funds FROM Kirra's liable account TO the club's balance account. This is appropriate for resolving a negative balance that Kirra wants to cover. If the intent is to debit the club's bank account, that uses a different transfer instrument (bank transfer), which is more complex and should be a follow-up.

---

## Step 7D: Superadmin UI for Negative Balances

### File to modify: `src/app/superadmin/organizations/page.tsx` (or list view)

Add visual indicators for orgs with negative balances:
- Show a warning badge/icon next to orgs where `adyenPlatformAccount.hasNegativeBalance === true`
- Show the negative balance amount

### File to modify: `src/app/superadmin/organizations/[slug]/page.tsx`

In the Adyen Platform Account card (added in Phase 3E):
- Show negative balance status and amount
- "Top Up Balance" button → calls `POST /api/organization/adyen-transfer`
- Show transfer history for the org

---

## Verification / Test Plan

1. **Simulate negative balance**:
   - Process a payment for a platform org
   - Wait for the sweep to transfer funds to the bank
   - Refund the payment (balance goes negative)
   - Verify `negativeBalanceCompensationWarning.scheduled` webhook arrives
   - Verify `AdyenPlatformAccount.hasNegativeBalance` is set to true

2. **Top up balance**:
   - Use superadmin endpoint to trigger a top-up transfer
   - Verify transfer succeeds in Adyen
   - Verify `hasNegativeBalance` is cleared

3. **UI indicators**:
   - Verify superadmin org list shows warning for negative-balance orgs
   - Verify org detail page shows negative balance info and top-up button
