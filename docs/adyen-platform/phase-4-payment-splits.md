# Phase 4: Payment Processing with Splits

**Type**: Backend modification (existing payment flow)
**Depends on**: Phase 3 (at least one org must be onboarded with a verified store + split config)
**Blocks**: Phase 5 (refunds), Phase 6 (recurring)
**Estimated effort**: 2-3 days
**Risk to existing functionality**: MEDIUM -- modifies the core checkout flow. Mitigated by fallback strategy.

## Overview

Update the checkout session creation to include the Adyen store reference for platform-onboarded organizations. The store's linked split configuration profile handles splitting automatically -- we do NOT calculate splits in our code. For non-onboarded orgs, the existing single-merchant flow continues unchanged.

## Adyen Prerequisites

- At least one test organization fully onboarded (Phase 3) with:
  - Verified account holder
  - Store created
  - Balance account active
- Platform merchant account: `KirraCapital_Leapfrog_TEST`
- **Split configuration profile** must be created before this phase (deferred from Phase 0):
  1. Adyen Customer Area > Platform > New split configuration
  2. Create profile "Leapfrog Default Split" with commission rules
  3. Note the Split Configuration ID (UUID)
  4. Link it to the test org's store via Management API or Customer Area

---

## Step 4A: Update `createPaymentSession()` in `src/lib/adyen.ts`

### Current signature (line 114):
```typescript
export async function createPaymentSession(
  amount: number,
  currency: string = "USD",
  reference: string,
  returnUrl: string,
  shopperEmail?: string,
  lineItems?: any[]
)
```

### New signature:
```typescript
export async function createPaymentSession(
  amount: number,
  currency: string = "USD",
  reference: string,
  returnUrl: string,
  shopperEmail?: string,
  lineItems?: any[],
  platformOptions?: {
    storeId: string;
    countryCode: string;
    merchantAccount?: string;
  }
)
```

### Implementation changes

The key change is adding an optional `platformOptions` parameter. When provided, the session includes the `store` reference and uses the platform merchant account. When not provided, the existing behavior is preserved.

```typescript
export async function createPaymentSession(
  amount: number,
  currency: string = "USD",
  reference: string,
  returnUrl: string,
  shopperEmail?: string,
  lineItems?: any[],
  platformOptions?: {
    storeId: string;
    countryCode: string;
    merchantAccount?: string;
  }
) {
  try {
    const merchantAccount = platformOptions?.merchantAccount
      || process.env.ADYEN_MERCHANT_ACCOUNT
      || "TestMerchant";

    const countryCode = platformOptions?.countryCode || "US";

    const sessionRequest: any = {
      amount: { currency, value: Math.round(amount * 100) },
      reference,
      returnUrl,
      merchantAccount,
      shopperEmail,
      lineItems,
      channel: "Web",
      countryCode,
    };

    // For platform-onboarded orgs: include store reference
    // The split configuration profile linked to the store handles splits automatically
    if (platformOptions?.storeId) {
      sessionRequest.store = platformOptions.storeId;
    }

    const response = await checkoutApi.PaymentsApi.sessions(sessionRequest);
    return response;
  } catch (error) {
    console.error("Error creating Adyen session:", error);
    throw error;
  }
}
```

### What this achieves

When `store` is included in the session request:
1. Adyen routes the payment through that store
2. The split configuration profile linked to the store automatically splits the funds
3. The club's share goes to their balance account
4. The platform commission goes to Kirra's liable account
5. No `splits` array needed in our code

When `store` is NOT included (fallback):
1. Payment is processed under the single merchant account
2. No splits, no balance account involvement
3. Existing behavior preserved

---

## Step 4B: Update Checkout Session Route

### File to modify: `src/app/api/sites/[slug]/checkout/session/route.ts`

### Changes needed

After resolving the organization (around line 78), look up the platform account:

```typescript
// After: const organizationId = config.organizationId;

// Check if this org is onboarded to the Adyen platform
const platformAccount = await db.adyenPlatformAccount.findUnique({
  where: { organizationId },
  select: {
    storeId: true,
    onboardingStatus: true,
    organization: {
      select: { country: true }
    }
  },
});

const platformOptions = (
  platformAccount?.onboardingStatus === "VERIFIED" && platformAccount?.storeId
) ? {
  storeId: platformAccount.storeId,
  countryCode: platformAccount.organization.country || "US",
  merchantAccount: process.env.ADYEN_PLATFORM_MERCHANT_ACCOUNT,
} : undefined;
```

Then pass `platformOptions` when creating the session (around line 950):

```typescript
const session = await createPaymentSession(
  total,
  "USD",
  invoice.id,
  returnUrl,
  resolvedContact.email,
  undefined,  // lineItems
  platformOptions,
);
```

### Important: Do NOT add Idempotency-Key in this phase

Adyen sessions are already idempotent by reference. Adding `Idempotency-Key` headers is only needed for `/payments` calls (Phase 6, recurring charges). Sessions via `/sessions` do not need it.

---

## Step 4C: Update `createPaymentLink()` in `src/lib/adyen.ts`

Apply the same fallback pattern:

### Current signature (line 141):
```typescript
export async function createPaymentLink(
  amount: number,
  currency: string = "USD",
  reference: string,
  description?: string,
  expiresAt?: string
)
```

### New signature:
```typescript
export async function createPaymentLink(
  amount: number,
  currency: string = "USD",
  reference: string,
  description?: string,
  expiresAt?: string,
  platformOptions?: {
    storeId: string;
    countryCode: string;
    merchantAccount?: string;
  }
)
```

Add `store` to the payment link request if `platformOptions` is provided, same pattern as session creation.

### Update callers

Search for all callers of `createPaymentLink()` and update them to pass `platformOptions` when available. Key callers:
- `src/app/dashboard/financials/invoices/page.tsx` (or its API route)
- `src/app/api/pos/payment-link/route.ts` (if it exists)

---

## Step 4D: Update POS Checkout

### File to modify: `src/app/pos/(terminal)/payment/page.tsx`

If the POS creates payment sessions or payment links, apply the same `platformOptions` lookup pattern. Look up the current org's `AdyenPlatformAccount` and pass the `storeId` if available.

---

## Verification / Test Plan

1. **Platform org payment**:
   - Process a checkout payment for the org onboarded in Phase 3
   - Verify in Adyen Customer Area that the payment appears with split breakdown
   - Verify club's share is in their balance account
   - Verify platform commission is in Kirra's liable account

2. **Non-platform org payment (regression test)**:
   - Process a checkout payment for an org WITHOUT an `AdyenPlatformAccount`
   - Verify the existing single-merchant flow works unchanged
   - Verify no errors about missing store or balance account

3. **Payment link for platform org**:
   - Create a payment link for a platform org
   - Verify the link processes correctly with splits

4. **$0 checkout still works**:
   - Verify the $0 checkout path (line 880 in checkout route) is unaffected
   - It skips Adyen entirely, so it should work regardless of platform status

5. **Webhook confirmation**:
   - After a platform payment, verify the AUTHORISATION webhook still fires
   - Verify the transfer webhook shows the split in `balancePlatform.transfer.created`
