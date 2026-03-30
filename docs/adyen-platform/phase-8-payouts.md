# Phase 8: Payouts Build-Out

**Type**: Backend + frontend + DevOps tooling
**Depends on**: Phases 2 (webhooks), 7 (reporting)
**Blocks**: Nothing
**Estimated effort**: 3-5 days
**Risk to existing functionality**: Low -- extends existing webhook handler and payouts page

## Overview

Complete the payouts pipeline by enhancing the webhook handler to extract bank account details and estimated arrival times, linking transactions to payouts via a foreign key, building a payout detail view, adding filters/pagination to the payouts list, and creating a multi-environment provisioning script.

### Architecture

Payouts use the Adyen Balance Platform sweep model (not the deprecated Payout API):

```
Adyen Balance Platform
├── Daily Sweep (push, regular priority)
│   └── Moves funds from org balance account → org bank account
├── Transfer Webhook (balancePlatform.transfer.created/updated)
│   └── Creates/updates Payout records in our database
└── Tracking Events
    └── Provide estimated arrival time and bank credit confirmation
```

The sweep is configured during onboarding finalization (`POST /api/organization/adyen-onboarding/finalize`) with:

- `type: "push"` -- push funds out of the balance account
- `schedule: { type: "daily" }` -- runs daily
- `priorities: ["regular"]` -- standard bank transfer speed

### Fees

In the Balance Platform model, platform fees are collected via fee splits on incoming payments (configured at the store/split level), not deducted from outgoing sweeps. The sweep transfer amount IS the net amount after Adyen's internal splits, so `fees: 0` is architecturally correct for sweep-based payouts.

---

## Step 8A: Schema Changes

### File: `prisma/schema.prisma`

Add `payoutId` foreign key to `Transaction` to explicitly link settled transactions to the payout that covered them. Add `estimatedArrivalTime` to `Payout` from Adyen's tracking webhook events.

```prisma
model Transaction {
  // ... existing fields ...
  payoutId  String?
  payout    Payout?  @relation(fields: [payoutId], references: [id])

  @@index([payoutId])
}

model Payout {
  // ... existing fields ...
  estimatedArrivalTime DateTime?
  transactions         Transaction[]
}
```

Migration: `npx prisma migrate dev --name add-payout-transaction-link`

---

## Step 8B: Adyen Platform Helper

### File: `src/lib/adyen-platform.ts`

Add `getTransferInstrumentLast4(transferInstrumentId)` function that calls the LEM API's `TransferInstrumentsApi.getTransferInstrument()` endpoint to retrieve bank account details and extract the last 4 digits of the account number.

---

## Step 8C: Webhook Enhancements

### File: `src/app/api/webhooks/adyen-balance-platform/route.ts`

Enhance `handleBankTransfer()`:

1. **Bank account lookup**: Use `transfer.counterparty.transferInstrumentId` to look up the last 4 digits via the LEM API. Only calls the API on first creation (when `bankAccount` is null).

2. **Estimated arrival time**: Extract from `transfer.tracking.estimatedArrivalTime` or the events array tracking entries.

3. **Transaction linking**: When a payout reaches PAID status, find all SETTLED transactions for that org (with `payoutId: null` and `settledAt <= payout.createdAt`) and update them with the payout ID.

4. **Status mapping**: `received` → PENDING, `pendingApproval`/`authorised` → SCHEDULED, `booked` → PAID, `failed`/`refused`/`returned` → FAILED.

---

## Step 8D: API Route Fixes

### Fix tenant isolation: `src/app/api/payouts/route.ts`

Replace raw `db` with `getScopedDb` for all payout queries. Use `parseDateOnly()` for date-only filter parameters.

### Fix nextScheduled: `src/app/api/financials/overview/route.ts`

Replace hardcoded `nextScheduled: null` with a query for the next SCHEDULED payout.

### Fix orgsWithNegativeBalance: `src/lib/settlement-reporting.ts`

Replace incorrect `adyenPlatformAccount.count({ where: { onboardingStatus: "VERIFIED" } })` with `0` until negative balance state tracking is implemented.

### New endpoint: `src/app/api/payouts/[id]/route.ts`

`GET /api/payouts/:id` returns a payout with its linked transactions via the new relation. Uses `getScopedDb` for tenant isolation.

---

## Step 8E: Payouts Page Enhancements

### File: `src/app/dashboard/financials/payouts/page.tsx`

- Status filter dropdown (All / Pending / Scheduled / Paid / Failed)
- Date range picker (From / To inputs)
- Pagination controls (previous/next with page counter)
- Sweep schedule info badge
- Clickable rows that navigate to payout detail view

### File: `src/app/dashboard/financials/payouts/[id]/page.tsx` (new)

Payout detail page showing:

- Summary cards: gross, fees, net, bank account
- Timeline: created, scheduled, estimated arrival, paid dates
- Included transactions table with PSP reference, type, method, amount, settled date

---

## Step 8F: Multi-Environment Provisioning Script

### File: `scripts/provision-adyen.ts` (new)

Environment-agnostic script that uses Adyen's Management API v3 to:

1. Create API credentials with correct roles (checkout, platform, LEM)
2. Generate API keys for each credential
3. Create webhook subscriptions pointing to the environment's admin URL
4. Generate HMAC keys for each webhook
5. Output a `.env` fragment

```bash
npx tsx scripts/provision-adyen.ts --env staging --dry-run
npx tsx scripts/provision-adyen.ts --env production --output .env.adyen
npx tsx scripts/provision-adyen.ts --env staging --deploy-ssh uplifter-staging
```

Replaces the older `scripts/provision-adyen-staging.ts` (kept for backward compatibility).

---

## Testing

### Local testing with ngrok

1. Start ngrok: `ngrok http 3000`
2. Set `WEBHOOK_TUNNEL_URL` in `.env` to your ngrok URL
3. Run: `npx tsx scripts/provision-adyen.ts --env local`
4. Trigger a test sweep in the Adyen Customer Area under Balance Platforms → Transfers

### Verifying webhook handling

1. Create a test transfer in the Adyen Customer Area
2. Check server logs for `[BP-WEBHOOK] Payout created` / `Payout updated`
3. Verify bank account last 4 digits are populated
4. Verify transaction linking when status reaches PAID

### Verifying the UI

1. Navigate to Dashboard → Financials → Payouts
2. Verify stats cards show correct data
3. Test status filter and date range filters
4. Click a payout row to view the detail page
5. Verify linked transactions appear in the detail view
6. Test CSV export

---

## Key Files

| File                                                   | Role                                                 |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `prisma/schema.prisma`                                 | Transaction.payoutId FK, Payout.estimatedArrivalTime |
| `src/lib/adyen-platform.ts`                            | `getTransferInstrumentLast4()` helper                |
| `src/app/api/webhooks/adyen-balance-platform/route.ts` | Enhanced bank transfer handler                       |
| `src/app/api/payouts/route.ts`                         | Payouts list/create API (tenant-isolated)            |
| `src/app/api/payouts/[id]/route.ts`                    | Payout detail API                                    |
| `src/app/api/financials/overview/route.ts`             | Fixed nextScheduled                                  |
| `src/lib/settlement-reporting.ts`                      | Fixed orgsWithNegativeBalance                        |
| `src/app/dashboard/financials/payouts/page.tsx`        | Enhanced payouts list page                           |
| `src/app/dashboard/financials/payouts/[id]/page.tsx`   | Payout detail page                                   |
| `scripts/provision-adyen.ts`                           | Multi-environment provisioning                       |
