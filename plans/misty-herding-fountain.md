# Context

USC-229: Local testing for free trial execution.

The free trial billing flow is hard to test locally because:

1. The subscription billing cron (`/api/cron/subscription-billing`) runs on the 1st of every month
2. Trial orgs have a 30-day `trialEndsAt` date set at signup — no way to fast-forward it without a DB edit
3. There's no mechanism to trigger billing for a single org in isolation

The fix: a dev-only checkbox in the org signup flow. When checked, the newly created org gets `trialEndsAt = yesterday`, and the client fires the billing cron logic automatically after 60 seconds — no CLI, no Prisma Studio, no manual steps.

---

## Key Files

| Purpose                        | Path                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| Org signup API                 | `src/app/api/org-signup/route.ts`                                      |
| Org signup UI                  | `src/app/org-signup/` (find the form component with the submit button) |
| Core billing logic             | `src/lib/subscription-billing.ts`                                      |
| Billing cron route             | `src/app/api/cron/subscription-billing/route.ts`                       |
| OrganizationSubscription model | `prisma/schema.prisma` (~line 3347)                                    |
| Env domains config             | `src/lib/env-domains.ts`                                               |

---

## Approach

### 0. Fix the gap in `generateMonthlyInvoices()`

In `src/lib/subscription-billing.ts`, inside the loop over subscriptions (after the `amount <= 0` skip, around line 82), add:

```ts
// Skip if trial hasn't ended yet
if (sub.trialEndsAt && sub.trialEndsAt > now) {
  skipped++;
  continue;
}
```

This ensures TRIALING orgs are only billed once `trialEndsAt` has passed. No other changes to billing logic needed.

### 1. Dev-only checkbox in the org signup form

In the signup form (just before the "Create Organization" submit button on final step), add:

```tsx
{
  (process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "local" ||
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "development") && (
    <label>
      <input type="checkbox" name="runCronAfterCreation" />
      Run Payment Cron Job after org creation (dev and local only)
    </label>
  );
}
```

- Gated on `APP_ENVIRONMENT === 'local' || APP_ENVIRONMENT === 'development'` — explicitly excludes staging and production
- Passes `runCronAfterCreation: true` in the form submission payload

### 2. Modified `/api/org-signup` route

When `runCronAfterCreation === true` in the request body:

- Set `trialEndsAt = new Date(Date.now() - 86400000)` (yesterday) instead of the normal 30-day window
- Return the newly created `organizationId` in the response (it should already be returned once the org is created, but need to make sure)
- No other changes to the signup logic

### 3. Dev-only billing trigger endpoint: `POST /api/dev/trigger-trial-billing`

Create `src/app/api/dev/trigger-trial-billing/route.ts`.

**Guards:**

```ts
import { getCurrentEnvironment } from "@/lib/env-domains";
const env = getCurrentEnvironment();
if (env !== "local" && env !== "development") {
  return NextResponse.json(null, { status: 404 });
}
```

- Require `Authorization: Bearer {CRON_SECRET}` header (timing-safe comparison, same pattern as all cron routes)

**Request body:** `{ organizationId: string }`

**What it does:**

1. Verify org exists with a `TRIALING` subscription
2. Call `generateMonthlyInvoices()` — already handles TRIALING orgs
3. Query pending `SubscriptionInvoice` records for this org
4. Call `processInvoicePayment(invoice.id)` for each
5. Return `{ invoices: [...], paymentResults: [...] }`

Reuses existing functions from `src/lib/subscription-billing.ts` — no reimplementation.

### 4. Client-side countdown after org creation

After a successful org creation response (when `runCronAfterCreation` was checked), the signup UI:

1. Shows a visible banner/toast: "Cron job will run in 15 seconds..."
2. Counts down on the client using `setTimeout(15_000, ...)`
3. After 15 seconds, fires `POST /api/dev/trigger-trial-billing` with the new `organizationId` and the `CRON_SECRET` from an env var exposed to the client (`NEXT_PUBLIC_CRON_SECRET` — dev only, never set in production)
4. Updates the banner to show the result ("Invoice generated, payment attempted")

---

## What this does NOT change

- Production code paths — the checkbox and endpoint both return 404/are hidden in production
- The billing cron schedule or logic
- No seed data changes needed (the signup flow creates the org correctly)
- No CLI scripts needed

---

## Open question

Confirm the org signup UI location and that `startup.uplifter.localhost` is accessible locally — or if the superadmin "create org" flow is a better insertion point.

---

## Verification

1. Run `pnpm dev` with local DB
2. Navigate to `startup.uplifter.localhost:3000` (or superadmin create org)
3. Fill out org signup form, check "Run Cron Job after org creation"
4. Submit — org is created with `trialEndsAt = yesterday`
5. Observe the 60-second countdown banner in the UI
6. After countdown: check the banner for invoice/payment result
7. Confirm in Prisma Studio (`pnpm db:studio`): `SubscriptionInvoice` with `PAID`/`FAILED` status, `SubscriptionPaymentAttempt` created
8. Confirm email in MailHog (`localhost:8025`)
