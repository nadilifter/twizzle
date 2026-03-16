# Phase 3: Club Onboarding Flow

**Type**: Backend API routes + frontend dashboard page
**Depends on**: Phase 1 (schema + API client), Phase 2 (webhooks must be live to receive status updates)
**Blocks**: Phase 4 (payments need onboarded orgs)
**Estimated effort**: 3-5 days
**Risk to existing functionality**: None -- new API routes and replaces a hardcoded mockup page

## Overview

Build the onboarding flow that creates Adyen platform resources for an organization and redirects club admins to Adyen's hosted onboarding page. The flow is:

1. Club admin clicks "Start Onboarding" in the dashboard
2. Our API creates Legal Entity, Business Line, Account Holder, and Balance Account via Adyen APIs
3. We generate a hosted onboarding link and redirect the admin to Adyen's page
4. Admin completes verification on Adyen's hosted page (provides business details, ID, bank info)
5. Adyen sends webhook updates as verification progresses (handled by Phase 2)
6. After verification passes, we create the Store (with split config) and configure Sweeps

## Adyen Prerequisites

- Phase 0 complete: all env vars set, API credentials have LEM + Configuration + Management roles
- Phase 2 complete: balance platform webhook route deployed and receiving events
- Onboarding theme (Step 0.4): deferred, `ADYEN_ONBOARDING_THEME_ID` is optional (uses Adyen default)

---

## Step 3A: Onboarding Initiation API Route

### File to create: `src/app/api/organization/adyen-onboarding/route.ts`

### POST -- Initiate Onboarding

**Auth**: Requires authenticated session with `financials.create` permission or admin (`*`).

**Flow**:
1. Get the current organization from the session
2. Check if `AdyenPlatformAccount` already exists for this org -- if yes, return current status
3. Load `Organization` data (name, address, phone, email, country)
4. Call Adyen APIs in sequence (if any call fails, return error and do not proceed):

**API Call 1: Create Legal Entity**
```
POST /legalEntities (LEM API)
{
  "type": "organization",
  "organization": {
    "legalName": org.name,
    "registeredAddress": {
      "street": org.street,
      "city": org.city,
      "stateOrProvince": org.stateProvince,
      "postalCode": org.postalCode,
      "country": org.country  // "US" or "CA"
    }
  }
}
```

**API Call 2: Create Business Line**
```
POST /businessLines (LEM API)
{
  "legalEntityId": legalEntity.id,
  "industryCode": "71394",  // NAICS: Fitness and Recreational Sports Centers
  "service": "paymentProcessing",
  "salesChannels": [{ "source": "eCommerce" }],
  "webData": [{ "webAddress": "https://{org.slug}.yourdomain.com" }]
}
```

Note: The NAICS code `71394` is "Fitness and Recreational Sports Centers." Verify this is appropriate for gymnastics gyms. Alternative: `611620` (Sports and Recreation Instruction).

**API Call 3: Create Account Holder**
```
POST /accountHolders (Configuration API)
{
  "legalEntityId": legalEntity.id,
  "description": org.name,
  "balancePlatform": process.env.ADYEN_BALANCE_PLATFORM,
  "capabilities": {
    "receivePayments": { "requested": true, "requestedLevel": "notApplicable" },
    "sendToTransferInstrument": { "requested": true, "requestedLevel": "notApplicable" },
    "receiveFromBalanceAccount": { "requested": true, "requestedLevel": "notApplicable" }
  }
}
```

**API Call 4: Create Balance Account**
```
POST /balanceAccounts (Configuration API)
{
  "accountHolderId": accountHolder.id,
  "description": `${org.name} - Primary`
}
```

5. Save all IDs to `AdyenPlatformAccount`:
```typescript
await db.adyenPlatformAccount.create({
  data: {
    organizationId: org.id,
    legalEntityId: legalEntity.id,
    businessLineId: businessLine.id,
    accountHolderId: accountHolder.id,
    balanceAccountId: balanceAccount.id,
    onboardingStatus: "PENDING_HOSTED",
  },
})
```

6. Return success with the created record.

**Error handling**: If any Adyen API call fails after a previous one succeeded (e.g., business line creation fails after legal entity was created), log the partial state. The record should still be saved with whatever IDs were obtained. The admin can retry, and the code should handle the case where some entities already exist.

### GET -- Get Onboarding Status

**Auth**: Requires authenticated session.

Return the `AdyenPlatformAccount` for the current organization, or `null` if not started. Include:
- `onboardingStatus`
- `verificationStatus`
- `capabilities` (JSON)
- Whether store and sweep are configured

---

## Step 3B: Onboarding Link API Route

### File to create: `src/app/api/organization/adyen-onboarding/link/route.ts`

### POST -- Generate Hosted Onboarding Link

**Auth**: Requires authenticated session with admin permissions.

**Flow**:
1. Load the org's `AdyenPlatformAccount`
2. Verify it exists and has a `legalEntityId`
3. Call the LEM API:

```
POST /legalEntities/{legalEntityId}/onboardingLinks (LEM API)
{
  "redirectUrl": "https://admin.{domain}/dashboard/financials/onboarding"
  // "themeId" is optional -- omit to use Adyen default branding
  // Include only if ADYEN_ONBOARDING_THEME_ID is set
}
```

4. Return `{ url: response.url }` -- the Adyen-hosted onboarding page URL
5. Update `onboardingStatus` to `IN_PROGRESS`

The frontend will redirect the user to this URL. After the user completes (or exits) the hosted page, they'll be redirected back to the `redirectUrl`.

---

## Step 3C: Post-Verification Setup (Store + Sweep)

### File to create: `src/app/api/organization/adyen-onboarding/finalize/route.ts`

This endpoint is called after the onboarding status reaches `VERIFIED` (either manually by superadmin or automatically triggered by the webhook handler).

### POST -- Finalize Onboarding

**Auth**: Requires authenticated session with admin or superadmin permissions.

**Flow**:
1. Load the org's `AdyenPlatformAccount`
2. Verify `onboardingStatus` is `VERIFIED`
3. Skip if `storeId` is already set (idempotent)

**API Call: Create Store**
```
POST /stores (Management API)
{
  "merchantId": process.env.ADYEN_PLATFORM_MERCHANT_ACCOUNT,
  "description": org.name,
  "reference": `store-${org.slug}`,
  "address": {
    "country": org.country,
    "line1": org.street,
    "city": org.city,
    "stateOrProvince": org.stateProvince,
    "postalCode": org.postalCode
  },
  "phoneNumber": org.phone,
  // splitConfiguration is added later in Phase 4 when the split profile is created
}
```

The store is created without a split configuration initially. The split profile is linked to the store in Phase 4 when payment processing with splits is implemented.

**API Call: Create Sweep** (if transfer instrument is available)
```
POST /balanceAccounts/{balanceAccountId}/sweeps (Configuration API)
{
  "counterparty": {
    "transferInstrumentId": "..."  // Created during hosted onboarding when user provided bank details
  },
  "type": "push",
  "schedule": { "type": "daily" },
  "priorities": ["regular"],
  "currency": "USD",
  "triggerAmount": { "value": 0, "currency": "USD" },
  "status": "active"
}
```

The `transferInstrumentId` is created by Adyen during the hosted onboarding process when the user provides their bank account details. To get it:
- Call `GET /accountHolders/{id}` via Configuration API
- Look for `primaryBalanceAccount` or check the account holder's transfer instruments
- Or receive it via the `balancePlatform.paymentInstrument.created` webhook

4. Update `AdyenPlatformAccount` with `storeId`, `storeReference`, `sweepId`

---

## Step 3D: Update Onboarding Dashboard Page

### File to modify: `src/app/dashboard/financials/onboarding/page.tsx`

Replace the current hardcoded mockup (which has `const isFullyVerified = true` hardcoded) with a live page.

### Current state of the file

The current page is a static mockup that shows:
- Legal Entity status (always green checkmark)
- Identity Verification status (always green checkmark)
- Bank Account status (always green checkmark)
- Hardcoded account ID
- ACH setup dialog

### New behavior

**State: No `AdyenPlatformAccount` exists**
- Show a "Start Onboarding" card explaining what onboarding involves
- Button: "Begin Verification" → calls `POST /api/organization/adyen-onboarding`
- After API returns, show success and "Continue to Adyen" button

**State: `PENDING_HOSTED`**
- Show that account structure is created
- Button: "Complete Verification" → calls `POST /api/organization/adyen-onboarding/link`, then redirects to the returned URL

**State: `IN_PROGRESS` / `IN_REVIEW`**
- Show verification progress
- Parse `capabilities` JSON to show per-capability status (receivePayments, sendToTransferInstrument, etc.)
- Each capability: pending (yellow), allowed (green), or problem (red)
- "Check Status" button that refreshes the page (status updates come via webhook)

**State: `VERIFIED`**
- Show success state (green alert, similar to current mockup)
- If store is not yet configured: show "Finalize Setup" button → calls finalize endpoint
- If store is configured: show full success with store ID, balance account ID

**State: `REJECTED`**
- Show error state with explanation
- Link to re-open hosted onboarding page to fix issues

### Keep existing UI patterns
- Use the same Shadcn components: `Card`, `Alert`, `Button`
- Keep the `Building2Icon`, `UserIcon`, `UniversityIcon` layout for the three status rows
- Replace hardcoded values with real data

---

## Step 3E: Add Superadmin Visibility

### File to modify: `src/app/superadmin/organizations/[slug]/page.tsx`

Add a new section/card to the organization detail page:

**"Adyen Platform Account" card**:
- Show `onboardingStatus`, `verificationStatus`
- Show all Adyen entity IDs (legal entity, account holder, balance account, store)
- Show capabilities JSON (collapsible)
- Button: "Initiate Onboarding" (if no account exists) → calls POST /api/organization/adyen-onboarding with orgId override
- Button: "Generate Onboarding Link" → calls POST /api/organization/adyen-onboarding/link
- Button: "Finalize Setup" → calls POST /api/organization/adyen-onboarding/finalize
- Button: "Refresh Status" → calls GET /api/organization/adyen-onboarding

This gives superadmins full control over the onboarding process for any organization.

---

## Verification / Test Plan

1. **Start onboarding for a test organization**:
   - Click "Begin Verification" on the dashboard
   - Verify Legal Entity, Business Line, Account Holder, Balance Account are created in Adyen sandbox
   - Verify `AdyenPlatformAccount` record is saved with all IDs

2. **Generate and visit hosted onboarding link**:
   - Click "Complete Verification"
   - Verify redirect to Adyen's hosted page with correct branding
   - Complete the hosted onboarding with Adyen's test data
   - Verify redirect back to dashboard

3. **Webhook status updates**:
   - After completing hosted onboarding, verify `balancePlatform.accountHolder.updated` webhook arrives
   - Verify dashboard shows updated verification status

4. **Finalize setup**:
   - After verification passes, create store and sweep
   - Verify store appears in Adyen Customer Area with correct split configuration

5. **Non-onboarded orgs are unaffected**:
   - Verify other organizations can still process payments normally via the existing single-merchant flow
