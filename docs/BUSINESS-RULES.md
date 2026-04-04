# Business Rules

This document captures decisions and behaviors that are not obvious from reading the code alone. It serves as a reference for developers, reviewers, and AI agents working on the codebase.

---

## Subscription Billing Lifecycle

Organizations progress through these states:

```
TRIALING -> ACTIVE -> PAST_DUE -> DEACTIVATED
                |                      |
                +<---- REACTIVATED ----+
```

### Invoice Generation

- Runs on the **1st of each month at noon UTC** via `subscription-billing` cron.
- Monthly plans are billed at `plan.monthlyPrice`.
- Yearly plans are billed monthly at `plan.yearlyPrice / 12`.
- **Idempotent**: if an invoice already exists for the same `organizationId` + `periodStart`, it is skipped.
- Organizations with `isActive: false` or `$0` plans are skipped.

### Payment Processing

- Tries each `OrganizationPaymentMethod` in order: default first, then by `priority` ascending, then `createdAt` ascending.
- **Expired cards are skipped** (compared by `expiryMonth`/`expiryYear` at month granularity).
- **Double-charge prevention**: uses `updateMany` with a `status IN (PENDING, FAILED)` guard to atomically claim the invoice for processing. If the claim returns 0 rows, the invoice is already being processed.
- On success: invoice marked `PAID`, grace period cleared, subscription set to `ACTIVE`.
- On all-methods-fail: invoice marked `FAILED`, org enters grace period.

### Grace Period and Dunning

- When all payment methods fail, the org gets a **30-day grace period** (`scheduledDeactivationDate` = now + 30 days).
- Subscription status is set to `PAST_DUE`.
- The `subscription-dunning` cron runs **daily at noon UTC** and:
  1. Resets invoices stuck in `PROCESSING` for over 1 hour back to `PENDING`.
  2. Retries all `PENDING` invoices.
  3. Sends warning emails at **30-day**, **7-day**, and **1-day** thresholds before deactivation. Each threshold is sent at most once (tracked via `dunningWarningsSent` JSON field).
  4. Deactivates organizations past their `scheduledDeactivationDate`.

### Deactivation

- Sets `isActive: false`, records `deactivatedBy: "system"` and `deactivationReason: "Non-payment"`.
- Subscription set to `PAUSED`.
- Adyen allowed origin removed for the org's subdomain.
- Status change logged in `OrganizationStatusLog`.

### Reactivation

- Triggered when a new payment method is added and the most recent `FAILED` invoice is successfully paid.
- Restores `isActive: true`, clears all deactivation fields and grace period.
- Subscription returned to `ACTIVE`.
- Adyen allowed origin re-registered.

---

## Recurring Billing (End-User Charges)

Handles automatic charges for memberships, passes, and enrollments.

- Runs **daily** via the `recurring-billing` cron.
- Only processes charges where `nextChargeDate <= today` and `status = ACTIVE`.
- **Minimum retry interval**: 20 hours between attempts (prevents double-charging if cron fires twice).
- **Max retries**: 3 attempts. After 3 failures, the charge status becomes `FAILED` and the linked entitlement is suspended.
- On success: `nextChargeDate` advances by 1 month (or 1 year for yearly), `failureCount` resets to 0, entitlement is extended.
- Product-linked charges are automatically **terminated** if the linked enrollment is cancelled/completed, or the linked pass/membership is cancelled/archived.
- **Pre-charge reminders** are sent 3 days before the charge date.
- **Idempotent reference**: each charge generates a deterministic reference `recurring-{chargeId}-{YYYY-MM-DD}` to prevent duplicate Adyen charges.

---

## Processing Fees

- The **organization always pays** processing fees. There is no user-facing fee option.
- Fee calculation: `(baseAmount + tax_if_customer_pays) * planTransactionFee + planPerTransactionFee`.
- Tax paid by setting: `CUSTOMER` (added to charge total) or `ORGANIZATION` (absorbed by org).

---

## Registration Rules

### Membership Eligibility

Programs, competitions, and events can require specific memberships. Eligibility checks include:

- **Gender restriction**: membership group may restrict to specific genders.
- **Age restriction**: min/max age on the membership group.
- **Level restriction**: membership group may require a specific level.
- **Purchase window**: `purchaseStartDate` and `purchaseEndDate` on the membership instance.

### Registration Windows

- Programs and events can have `registrationStartDate` and `registrationEndDate`.
- **Early access codes** allow registration before the window opens.
- Capacity is enforced: cannot register for full programs/events.

---

## Invitation Lifecycle

- Invitations expire after **7 days** (`expiresAt` set at creation time).
- **Single-use**: once accepted, status is set to `ACCEPTED` and the token cannot be reused.
- Two acceptance flows:
  - **New user** (no password): must set password during acceptance. Password is hashed and stored.
  - **Existing user** (has password): must be authenticated and email must match the invitation email.
- Statuses: `PENDING` -> `ACCEPTED` | `EXPIRED` | `CANCELLED`.

---

## Tenant Isolation

### Scoped Models

55 models are automatically scoped by `organizationId` via `getScopedDb()`. See the `TENANT_MODELS` array in `src/lib/db.ts` for the full list.

### How It Works

`getScopedDb(organizationId)` returns a Prisma Client Extension that:

- **Read operations** (`findMany`, `findFirst`, `findUnique`, `count`): inject `organizationId` into the `where` clause.
- **Create operations** (`create`, `createMany`): inject `organizationId` into the `data`.
- **Update/Delete** (`update`, `delete`): verify the record belongs to the org before mutating (throws `TenantIsolationError` if not).
- **Upsert**: checks that any existing record belongs to the same org.
- `findUnique` is converted to `findFirst` with an org filter to prevent direct-ID access bypass.

### Intentionally Excluded Models

These models are NOT auto-scoped and use raw `db` for valid reasons:

| Model                         | Reason                                                                  |
| ----------------------------- | ----------------------------------------------------------------------- |
| `OrganizationSubscription`    | Managed by superadmins and system cron jobs                             |
| `OrganizationFeatureOverride` | Superadmin-managed                                                      |
| `OrganizationPaymentMethod`   | System billing operations                                               |
| `AdyenPlatformAccount`        | Platform-level Adyen onboarding                                         |
| `OrganizationStatusLog`       | System audit trail                                                      |
| `SubscriptionInvoice`         | Cross-org billing system                                                |
| `SubscriptionPaymentAttempt`  | Cross-org billing system                                                |
| `SmsNumberAssignment`         | Number pool requires cross-org visibility to prevent routing collisions |

### Allowlist

Routes that legitimately use raw `db` are listed in `scripts/tenant-isolation-allowlist.txt`. The `pnpm lint:tenant` script checks for violations.

---

## Subdomain Rules

- Each organization gets a subdomain for their marketing site (e.g., `myclub.uplifter.app`).
- **Reserved words** are blocked during org signup (checked via `check-subdomain` endpoint).
- **Profanity check**: uses the `bad-words` library to reject offensive subdomains.
- **Character restrictions**: subdomains must be lowercase alphanumeric with hyphens.
- Duplicate subdomain names are prevented by a unique constraint on `WebsiteConfig.subdomain`.

---

## Cron Jobs

All cron jobs:

- Require `CRON_SECRET` in the `Authorization: Bearer` header (verified with timing-safe comparison).
- Support `?dryRun=true` to preview effects without mutations.
- Accept both GET and POST methods.
- Have `maxDuration: 300` (5 minutes).

| Cron                    | Schedule               | Purpose                                                                  |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `subscription-billing`  | 1st of month, noon UTC | Generate invoices and process subscription payments                      |
| `subscription-dunning`  | Daily, noon UTC        | Recover stuck invoices, retry pending, send warnings, deactivate expired |
| `recurring-billing`     | Daily                  | Process end-user recurring charges (memberships, passes, enrollments)    |
| `membership-renewal`    | Daily                  | Check and process membership renewals                                    |
| `pass-renewal`          | Daily                  | Check and process pass renewals                                          |
| `seasons`               | Daily                  | Manage season transitions and status updates                             |
| `process-notifications` | Frequent               | Process queued notification rules                                        |
| `sms-campaigns`         | Frequent               | Send scheduled SMS campaigns                                             |
| `holiday-reminders`     | Daily                  | Send upcoming holiday reminders                                          |
| `holiday-announcements` | Daily                  | Post holiday announcements                                               |
| `payment-method-check`  | Daily                  | Check for expiring payment methods                                       |
| `accounting-sync`       | Daily                  | Sync transactions to accounting integrations                             |
| `expire-reservations`   | Frequent               | Expire stale registration queue reservations                             |
| `cleanup`               | Daily                  | Clean up expired/orphaned data                                           |
