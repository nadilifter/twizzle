# Phase 7: Reporting and Financial Dashboard

**Type**: Backend service + frontend dashboard updates
**Depends on**: Phases 2, 4, 5 (needs accumulated transaction and transfer data)
**Blocks**: Nothing
**Estimated effort**: 3-5 days
**Risk to existing functionality**: Low -- primarily adds new views to existing dashboard pages

## Overview

Build settlement reporting that aggregates data from the Transaction, Payout, and webhook-captured transfer records. Update the financial dashboard to show financial data for clubs: transaction summaries, payout history, and negative balance alerts.

## Adyen Prerequisites

- None for API credentials -- all data comes from our database, populated by Phase 2 webhooks and Phase 4-5 refund/recurring flows
- Accumulated test transactions from previous phases provide the data to display

---

## Step 7A: Create Settlement Reporting Service

### File to create: `src/lib/settlement-reporting.ts`

This service provides data aggregation functions for financial reporting. All data comes from our database (no Adyen API calls needed for basic reporting).

### Functions to implement

```typescript
interface SettlementSummary {
  organizationId: string;
  organizationName: string;
  period: { start: Date; end: Date };
  grossPayments: number;
  refunds: number;
  chargebacks: number;
  netSettlement: number;
  payoutsCompleted: number;
  payoutsPending: number;
}

export async function getSettlementSummary(
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<SettlementSummary>
```

**Implementation approach**:
```typescript
export async function getSettlementSummary(
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<SettlementSummary> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  const transactions = await db.transaction.findMany({
    where: {
      organizationId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { type: true, amount: true, status: true },
  });

  const payouts = await db.payout.findMany({
    where: {
      organizationId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { amount: true, fees: true, net: true, status: true },
  });

  const grossPayments = transactions
    .filter(t => t.type === "PAYMENT" && t.status === "SETTLED")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const refunds = transactions
    .filter(t => t.type === "REFUND")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const chargebacks = transactions
    .filter(t => t.type === "CHARGEBACK")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const payoutsCompleted = payouts
    .filter(p => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.net), 0);

  const payoutsPending = payouts
    .filter(p => p.status === "PENDING" || p.status === "SCHEDULED")
    .reduce((sum, p) => sum + Number(p.net), 0);

  return {
    organizationId,
    organizationName: org?.name || "",
    period: { start: startDate, end: endDate },
    grossPayments,
    refunds,
    chargebacks,
    netSettlement: grossPayments - refunds - chargebacks,
    payoutsCompleted,
    payoutsPending,
  };
}
```

### Additional functions

```typescript
export async function getSuperadminOverview(
  startDate: Date,
  endDate: Date,
): Promise<{
  totalGrossVolume: number;
  totalPayouts: number;
  orgCount: number;
  orgsWithNegativeBalance: number;
}>

export async function getPayoutHistory(
  organizationId: string,
  limit?: number,
): Promise<Array<{
  id: string;
  amount: number;
  fees: number;
  net: number;
  status: string;
  scheduledAt: Date | null;
  paidAt: Date | null;
}>>
```

---

## Step 7B: Update Financial Dashboard for Club Admins

### File to modify: `src/app/dashboard/financials/page.tsx`

Add financial information for clubs.

### Changes

1. **Fetch platform account data**: On page load, check if the org has an `AdyenPlatformAccount`:
   ```typescript
   const platformAccount = await db.adyenPlatformAccount.findUnique({
     where: { organizationId },
     select: {
       onboardingStatus: true,
       balanceAccountId: true,
     },
   });
   ```

2. **Transaction summary card**:
   - Use `getSettlementSummary()` for current month / period
   - Show: gross payments, refunds, chargebacks, net

3. **Payout/sweep history table**:
   - Use `getPayoutHistory()` to list recent payouts
   - Show: date, amount, fees, net, status (pending/paid)

4. **For non-onboarded orgs**: Show existing dashboard content unchanged, plus a CTA to start onboarding.

### Data fetching approach

Create a server action or API route:
```typescript
// src/app/api/organization/financials/summary/route.ts
export async function GET(request: NextRequest) {
  // Get org from session
  // Call getSettlementSummary() and getPayoutHistory()
  // Return combined data
}
```

---

## Step 7C: Superadmin Financial Dashboard

### File to modify or create: Superadmin financial views

### Platform-wide overview

Create a superadmin financial overview page showing:

1. **Aggregate metrics**:
   - Total gross payment volume (all orgs)
   - Total payouts issued
   - Number of orgs with negative balances

2. **Per-org breakdown table**:
   - Org name
   - Onboarding status
   - Gross volume (month)
   - Net payouts (month)
   - Negative balance flag

3. **Filters**:
   - Date range picker
   - Filter by onboarding status
   - Filter by negative balance

---

## Verification / Test Plan

1. **Settlement summary accuracy**:
   - Process several payments, refunds, and chargebacks for a test org
   - Call `getSettlementSummary()` and verify totals match
   - Verify negative amounts for refunds and chargebacks

2. **Dashboard display**:
   - Log in as a club admin
   - Verify the financials page shows transaction summary and payout history

3. **Non-onboarded org regression**:
   - Log in as a club admin for a non-onboarded org
   - Verify the financials page shows existing content without platform-specific sections

4. **Superadmin overview**:
   - Log in as superadmin
   - Verify the financial overview shows aggregate data across all orgs
   - Verify per-org breakdown is accurate
   - Verify negative balance indicators

5. **Payout history**:
   - After sweeps have occurred (may need to wait or simulate)
   - Verify payout records appear with correct amounts and statuses
