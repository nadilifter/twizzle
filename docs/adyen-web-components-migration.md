# Adyen Web Components Migration Plan

This document catalogs the Adyen Web Components available via `@adyen/adyen-web` v6, maps them to existing platform features, and provides prioritized work chunks for migration.

## Table of Contents

- [Adyen Web Components Inventory](#adyen-web-components-inventory)
- [Platform Feature Mapping](#platform-feature-mapping)
- [Detailed Recommendations](#detailed-recommendations)
- [Prioritized Work Chunks](#prioritized-work-chunks)
- [Known Issues and Tech Debt](#known-issues-and-tech-debt)
- [Adyen Configuration Checklist](#adyen-configuration-checklist)
- [PCI Compliance Notes](#pci-compliance-notes)

---

## Adyen Web Components Inventory

The platform already has `@adyen/adyen-web` ^6.29.0 installed. The following components are available and relevant for US/Canada operations.

### Payment UI Components

| Component            | Type        | Description                                                                                                                                                                              |
| -------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Drop-in**          | `dropin`    | All-in-one payment UI that renders every enabled payment method (cards, wallets, bank). Simplest integration; Adyen controls the layout and adding new methods requires no code changes. |
| **Card**             | `card`      | Standalone credit/debit card form with PAN, expiry, CVV fields. Supports optional cardholder name and billing address. Supports Visa, Mastercard, Amex, Discover, JCB, etc.              |
| **Google Pay**       | `googlepay` | Google Pay wallet button. Presents the Google Pay payment sheet. Handles 3DS redirects. Works on Chrome (desktop + Android).                                                             |
| **Apple Pay**        | `applepay`  | Apple Pay wallet button. As of v6.10.0, works across all supported browsers and platforms (not just Safari).                                                                             |
| **ACH Direct Debit** | `ach`       | US bank account payment collection form (routing number, account number, account holder name). For collecting payments, not for payout onboarding.                                       |
| **PayPal**           | `paypal`    | PayPal checkout button. Opens PayPal window for authorization.                                                                                                                           |
| **Cash App Pay**     | `cashapp`   | Cash App Pay button for US shoppers.                                                                                                                                                     |

### Tokenization and Stored Payments

| Feature                       | Description                                                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stored Payment Methods**    | Built into Drop-in. When `showStoredPaymentMethods: true` is set, Drop-in renders saved cards with one-click payment. Requires `shopperReference` in the session.                        |
| **Token Creation**            | Sessions API with `storePaymentMethod: true` causes Drop-in/Card to show a "Save for later" checkbox. On consent, Adyen stores the method and fires a `recurring.token.created` webhook. |
| **Subscription Tokenization** | Use `recurringProcessingModel: "Subscription"` to create tokens suitable for merchant-initiated recurring charges.                                                                       |

### Special-Purpose Components

| Component        | Type       | Description                                                                                                                                                                                                                                              |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adyen Giving** | `donation` | Donation widget for post-checkout or standalone flows. Supports fixed donation amounts (up to 3 options) and round-up donations. Adyen covers processing fees; 100% goes to the nonprofit. Requires a Giving campaign configured in Adyen Customer Area. |

### Components Not Relevant to This Platform

| Component                      | Reason to Skip                                                   |
| ------------------------------ | ---------------------------------------------------------------- |
| SEPA Direct Debit              | EU-only; not needed for US/Canada                                |
| iDEAL                          | Netherlands-only                                                 |
| Klarna                         | Buy-now-pay-later; not aligned with sports registration use case |
| Bancontact, EPS, Giropay, etc. | EU/region-specific methods                                       |

---

## Platform Feature Mapping

### Summary Table

| Platform Feature                       | Current Implementation                         | Adyen Component(s)                   | Recommendation     | Status        |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------ | ------------------ | ------------- |
| Site checkout payment step             | Adyen Drop-in mounted in payment step          | Drop-in                              | **REPLACE**        | **Done (P0)** |
| Org signup payment                     | Adyen Drop-in with tokenization                | Drop-in + tokenization               | **REPLACE**        | **Done (P0)** |
| Adyen checkout wrapper                 | Dynamic env, configurable props, loading state | Drop-in (improved)                   | **ENHANCE**        | **Done (P0)** |
| Payment webhook (AUTHORISATION)        | New `/api/webhooks/adyen` route                | N/A (server-side)                    | **ADD**            | **Done (P0)** |
| Payment methods management (billing)   | Working; uses Adyen Drop-in for add            | Drop-in with wallet tokenization     | **KEEP + ENHANCE** | P1            |
| Add Payment Method dialog (financials) | Custom card/ACH form, simulated, unused        | N/A                                  | **DELETE**         | P1            |
| Donation page                          | Mock data, manual entry only                   | Adyen Giving                         | **REPLACE**        | P1            |
| ACH setup dialog (payouts)             | Custom bank form, simulated                    | N/A (payout onboarding, not payment) | **KEEP**           | P2            |
| POS payment                            | Adyen Pay by Link + QR code                    | N/A (correct approach for in-person) | **KEEP**           | --            |
| Billing address forms                  | Custom inputs for account/contact management   | N/A (not payment-specific)           | **KEEP**           | --            |
| Receipt/confirmation pages             | Custom display UI                              | N/A (no Adyen component exists)      | **KEEP**           | --            |
| Transaction tables                     | Custom display UI                              | N/A (no Adyen component exists)      | **KEEP**           | --            |
| Invoices/payment links                 | Adyen Pay by Link API (server-side)            | N/A (already correct)                | **KEEP**           | --            |

---

## Detailed Recommendations

### 1. DONE: Site Checkout Payment Step

**File:** `src/app/sites/[slug]/checkout/page.tsx`
**Status:** Implemented.

**What was done:**

- Replaced the "Coming Soon" placeholder with `AdyenCheckoutComponent` (Drop-in).
- `createPaymentSession()` now stores `sessionId`, `sessionData`, and `invoiceId` in state.
- On `onPaymentCompleted`, clears cart, completes registration, redirects to `/sites/[slug]/receipt/[invoiceId]`.
- Error handling with inline error banner and toast notifications.
- Waitlist items still show an informational card (no payment required).
- Fixed free checkout redirect bug (was missing `/sites/[slug]` prefix).

---

### 2. DONE: Org Signup Payment

**File:** `src/app/org-signup/payment/page.tsx`
**Status:** Implemented.

**What was done:**

- Converted from static server component to interactive `"use client"` component.
- Reads `org-signup-data` from sessionStorage on mount; redirects back if missing.
- Calls `POST /api/org-signup/payment-session` with `signupReference`, `email`, `returnUrl`.
- Shows plan summary card (plan name, monthly price, org name) alongside the payment form.
- On `onPaymentCompleted`: calls `POST /api/org-signup` with form data + `adyenShopperReference`, redirects to `/org-signup/success`.
- Error handling with retry and toast notifications.
- Token-linking fix: the org signup API now claims any orphaned payment methods created by the recurring webhook under the temporary `signup-*` shopperReference, re-links them to the new org.

---

### 3. DONE: Adyen Checkout Wrapper

**File:** `src/components/sites/adyen-checkout.tsx`
**Status:** Implemented.

**What was done:**

- Reads environment from `NEXT_PUBLIC_ADYEN_ENVIRONMENT` (falls back to `"test"`).
- Added props: `countryCode` (default `"US"`), `componentType` (default `"dropin"`), `adyenConfig` (optional overrides).
- Loading spinner while Adyen initializes, hidden container until ready.
- Proper cleanup using Adyen's `unmount()` method with cancellation guard.
- Stable callback refs to prevent unnecessary effect re-runs.
- Added `NEXT_PUBLIC_ADYEN_ENVIRONMENT` to `.env.example`.

This component is the shared foundation used by checkout, org signup, and billing.

---

### 4. KEEP + ENHANCE: Payment Methods Management (Billing)

**File:** `src/components/billing/payment-methods-card.tsx`
**Current state:** Fully functional. Lists stored payment methods, supports set-default, delete, and add-new via Adyen Drop-in in a dialog. Used on the billing page at `src/app/dashboard/usage/billing/page.tsx`.

**What to do:**

- Keep the management UI as-is (list, default, delete are custom business logic that Adyen doesn't provide).
- Enhance the "Add Payment Method" dialog to support Apple Pay and Google Pay as tokenization methods (currently only cards appear in the Drop-in because the session may not enable wallets).
- Ensure the tokenization session passes `allowedPaymentMethods: ["scheme", "applepay", "googlepay"]` to show wallet options.
- Consider showing card brand icons (Visa, MC, Amex) instead of the generic `CreditCard` icon.

**Backend changes:** Update `src/app/api/payment-methods/session/route.ts` to include allowed payment methods in the session config.

---

### 5. DELETE: Add Payment Method Dialog (Financials)

**File:** `src/components/financials/add-payment-method-dialog.tsx`
**Current state:** Custom card and ACH input form with plain `<Input>` fields collecting raw card numbers, expiry, and CVV. Submit is simulated (`setTimeout`). This component is not imported or used anywhere in the codebase.

**Why delete:**

- **PCI compliance risk:** Collecting raw card data in plain inputs means your server (or at least your client-side code) handles sensitive cardholder data. This disqualifies you from SAQ A (the simplest PCI validation) and requires SAQ A-EP or higher.
- **Not functional:** The submit handler is a simulated `setTimeout`, not wired to any API.
- **Superseded:** `PaymentMethodsCard` already handles the "add payment method" flow correctly via Adyen Drop-in.

**What to do:** Delete the file. If any future code references it, point to `PaymentMethodsCard` instead.

---

### 6. REPLACE: Donation Page with Adyen Giving

**File:** `src/app/campaigns/donation/page.tsx`
**Current state:** A data table of donations using hardcoded mock data. Has an "Add Donation" dialog for manual entry (donor name, amount, email) but no real payment processing. Refund action exists as a menu item with no handler.

**What to do:**

- Integrate the Adyen Giving component to accept real online donations.
- Create a donation campaign in the Adyen Customer Area (prerequisite, manual step).
- Add a new API route (`/api/donations/session` or similar) that creates a payment session and returns the `donationToken` required by Giving.
- Mount the Adyen Giving component on a public-facing donation page (or as a post-checkout widget on the site checkout receipt page).
- Keep the existing management table but wire it to real `Transaction` records from the database instead of mock data.
- Wire the refund action to Adyen's refund API.

**Backend changes:**

- New API route for donation sessions.
- Donation campaign configuration (Adyen Customer Area).
- Webhook handler for donation payment results.
- Wire donation table to real transaction data.

---

### 7. KEEP: ACH Setup Dialog (Payouts)

**File:** `src/components/financials/ach-setup-dialog.tsx`
**Current state:** Custom bank account form for payout onboarding (organizations entering their bank details to receive payouts). Simulated submit.

**Why keep:** Adyen's ACH Web Component is designed for _collecting payments from shoppers_, not for onboarding merchant payout bank accounts. The payout bank account setup is part of Adyen's KYC/onboarding flow, which uses a different API (Transfer API / Legal Entity Management API). This dialog serves a fundamentally different purpose than any Adyen Web Component.

**Future enhancement (out of scope):** Wire this form to the Adyen onboarding API to actually submit payout bank details, or use Adyen's Hosted Onboarding Page.

---

### 8. KEEP: All Other Areas

The following areas do not have corresponding Adyen Web Components and should remain custom:

- **POS Payment** (`src/app/pos/(terminal)/payment/page.tsx`) — Correctly uses Adyen Pay by Link + QR code for in-person payments. Web Components are for online checkout.
- **Billing Address Forms** (checkout, account, athletes billing) — Used for account and contact management beyond payment. Adyen's address fields are only relevant within the Card Component's `billingAddressRequired` config.
- **Receipt/Confirmation Pages** — Display-only UI after payment completion. No Adyen component exists for this.
- **Transaction Tables** — Admin display UI for viewing Adyen transactions. No Adyen component exists for this.
- **Invoices/Payment Links** — Already using Adyen Pay by Link API server-side correctly.

---

## Prioritized Work Chunks

### P0: Core Payment Enablement — DONE

All P0 items have been implemented. See [Adyen Configuration Checklist](#adyen-configuration-checklist) for the operational steps needed before testing.

#### Chunk 1: Enhance the Adyen Checkout Wrapper — DONE

**Scope:** `src/components/sites/adyen-checkout.tsx`

- [x] Replace hardcoded `environment: "test"` with dynamic value from `NEXT_PUBLIC_ADYEN_ENVIRONMENT`
- [x] Add `countryCode` prop (default `"US"`)
- [x] Add `componentType` prop to support `"dropin"`, `"card"`, etc. (default `"dropin"`)
- [x] Add optional config override prop for passing Adyen-specific options
- [x] Improve TypeScript types (use `CoreConfiguration` from Adyen SDK)
- [x] Add loading skeleton during initialization
- [x] Proper cleanup on unmount (use Adyen's `unmount()` method)

#### Chunk 2: Wire Up Site Checkout Payment Step — DONE

**Scope:** `src/app/sites/[slug]/checkout/page.tsx`

- [x] Replace the "Coming Soon" placeholder with the enhanced `AdyenCheckoutComponent`
- [x] Store `sessionId`, `sessionData`, and `invoiceId` from the session API response
- [x] Handle `onPaymentCompleted` — clear cart, complete registration, redirect to receipt
- [x] Handle `onPaymentFailed` and `onError` — show error banner with retry guidance
- [x] Handle waitlist items (shows informational card, no payment)
- [x] Fix free checkout redirect bug (`/receipt/...` → `/sites/[slug]/receipt/...`)

#### Chunk 3: Wire Up Org Signup Payment — DONE

**Scope:** `src/app/org-signup/payment/page.tsx`, `src/app/api/org-signup/route.ts`

- [x] Replace the "Coming Soon" placeholder with `AdyenCheckoutComponent` (tokenization mode)
- [x] Show selected plan summary alongside the payment form
- [x] Call the existing payment session API on page load
- [x] Handle `onPaymentCompleted` — create org with Adyen shopper reference, redirect to success
- [x] Handle errors with clear messaging and retry
- [x] Fix token-linking gap: org signup API now claims orphaned payment methods created under temporary `signup-*` references
- [x] Recurring webhook handler (`adyen-recurring`) now resolves `signup-*` references by looking up org by subdomain

#### Chunk 3b: Add Payment Webhook Handler — DONE (new)

**Scope:** `src/app/api/webhooks/adyen/route.ts` (new file)

- [x] Handle `AUTHORISATION` events for site checkout payments
- [x] HMAC signature verification
- [x] Idempotent: skips duplicate `pspReference` and already-paid invoices
- [x] Creates `Payment` + `Transaction` records, marks invoice `PAID`
- [x] Calls `processInvoiceRegistrations()` to create registrations from invoice metadata
- [x] Sends receipt email

#### Chunk 3c: Fix HMAC Key Mismatch — DONE (new)

- [x] Standardized env var to `ADYEN_WEBHOOK_HMAC_KEY` in `src/lib/adyen.ts` and `src/app/api/webhooks/adyen-recurring/route.ts`
- [x] Added `NEXT_PUBLIC_ADYEN_ENVIRONMENT` to `.env.example`

---

### P1: Enhancement and Cleanup

These improve existing functionality and reduce risk.

#### Chunk 4: Enhance Billing Payment Methods

**Scope:** `src/components/billing/payment-methods-card.tsx`, `src/app/api/payment-methods/session/route.ts`
**Effort:** Small-Medium (2-3 hours)
**Dependencies:** Chunk 1

- [ ] Update the tokenization session to include `allowedPaymentMethods` for wallets
- [ ] Add card brand icons (Visa, Mastercard, Amex, Discover) instead of generic `CreditCard` icon
- [ ] Consider adding Apple Pay / Google Pay as tokenization options in the "Add Payment Method" dialog

#### Chunk 5: Delete the Unused Payment Method Dialog

**Scope:** `src/components/financials/add-payment-method-dialog.tsx`
**Effort:** Tiny (15 minutes)
**Dependencies:** None

- [ ] Verify no imports reference this file (currently confirmed: zero imports)
- [ ] Delete `src/components/financials/add-payment-method-dialog.tsx`

#### Chunk 6: Integrate Adyen Giving for Donations

**Scope:** `src/app/campaigns/donation/page.tsx`, new API routes, Adyen Customer Area config
**Effort:** Large (5-8 hours)
**Dependencies:** Chunk 1 (shared checkout wrapper), Adyen Giving campaign setup

- [ ] Configure a donation campaign in Adyen Customer Area (manual prerequisite)
- [ ] Create API route for donation payment session / donation token
- [ ] Add Adyen Giving component to a public-facing donation page or post-checkout flow
- [ ] Replace mock donation data in the management table with real transaction records
- [ ] Wire refund action to Adyen refund API
- [ ] Add webhook handler for donation payment events

---

### P2: Deferred Enhancements

#### Chunk 7: Wire ACH Setup to Adyen Onboarding API

**Scope:** `src/components/financials/ach-setup-dialog.tsx`, `src/app/dashboard/financials/onboarding/page.tsx`
**Effort:** Medium (3-5 hours)
**Dependencies:** Adyen onboarding API access

- [ ] Replace simulated submit with actual Adyen onboarding/payout API call
- [ ] Or consider replacing entirely with Adyen's Hosted Onboarding Page

---

## Known Issues and Tech Debt

### 1. ~~Environment Hardcoding~~ — RESOLVED

**Fixed in:** Chunk 1. Reads from `NEXT_PUBLIC_ADYEN_ENVIRONMENT`, falls back to `"test"`.

### 2. Webhook URL Mismatch — PARTIALLY RESOLVED

**Files:** `src/lib/webhooks.ts`, `src/lib/services-config.ts`
**Issue:** `webhooks.ts` and `services-config.ts` reference `/api/webhooks/adyen` as a generic webhook URL.
**Current state:** There are now two separate webhook endpoints:

- `/api/webhooks/adyen` — handles `AUTHORISATION` events (site checkout payments)
- `/api/webhooks/adyen-recurring` — handles `RECURRING_CONTRACT` events (token lifecycle)

In Adyen Customer Area, you need to register _both_ endpoints (see [configuration checklist](#adyen-configuration-checklist)). You should also update `src/lib/webhooks.ts` and `src/lib/services-config.ts` to reference both endpoints if they are used for any admin/diagnostic purpose.

### 3. ~~HMAC Key Environment Variable Mismatch~~ — RESOLVED

**Fixed in:** Chunk 3c. Standardized to `ADYEN_WEBHOOK_HMAC_KEY` everywhere.

### 4. Pre-existing TypeScript errors in `src/lib/adyen.ts`

There are ~14 pre-existing TS errors in `src/lib/adyen.ts` (mostly `TS2531: Object is possibly null`, a `ChannelEnum` type mismatch, and a `PaymentLinkRequest` assignability issue). These are not related to the P0 work and should be cleaned up separately.

---

## Adyen Configuration Checklist

Before the payment flows work end-to-end, the following operational steps are required.

### 1. Environment Variables

Set these in your `.env` (see `.env.example` for the template):

| Variable                        | Where Used                             | Description                                                                    |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| `ADYEN_API_KEY`                 | Server-side (sessions, links, refunds) | Your Adyen API key from Customer Area → Developers → API credentials           |
| `ADYEN_MERCHANT_ACCOUNT`        | Server-side (all Adyen API calls)      | Your merchant account name                                                     |
| `NEXT_PUBLIC_ADYEN_CLIENT_KEY`  | Client-side (Web Components)           | Client key from Customer Area → Developers → API credentials → Client settings |
| `ADYEN_ENVIRONMENT`             | Server-side (API library)              | `TEST` or `LIVE`                                                               |
| `NEXT_PUBLIC_ADYEN_ENVIRONMENT` | Client-side (Web Components)           | `test` or `live` (lowercase)                                                   |
| `ADYEN_WEBHOOK_HMAC_KEY`        | Server-side (webhook verification)     | HMAC key generated when creating the webhook in Customer Area                  |

### 2. Register Webhook Endpoints in Adyen Customer Area

Go to **Customer Area → Developers → Webhooks** and create two webhook configurations:

#### Standard Notification (AUTHORISATION)

- **URL:** `https://yourdomain.com/api/webhooks/adyen`
- **Events:** `AUTHORISATION`
- **HMAC Key:** Generate one and copy it to `ADYEN_WEBHOOK_HMAC_KEY`
- **Purpose:** Fires when a site checkout payment is authorised. The handler creates Payment/Transaction records, marks the invoice as PAID, processes registrations, and sends receipt emails.

#### Standard Notification (RECURRING_CONTRACT)

- **URL:** `https://yourdomain.com/api/webhooks/adyen-recurring`
- **Events:** `RECURRING_CONTRACT`
- **HMAC Key:** Use the same key as above
- **Purpose:** Fires when a payment method token is created (org signup, billing "add payment method"). The handler stores the token as an `OrganizationPaymentMethod` record.

> **Note:** You can use a single webhook URL that filters by `eventCode` in your handler, or register two separate URLs. The current implementation uses two separate route handlers for clarity.

### 3. Enable Payment Methods in Adyen Customer Area

Go to **Customer Area → Settings → Payment methods** and enable the methods you want to accept:

- **Cards** (Visa, Mastercard, Amex, Discover) — essential
- **Apple Pay** — requires domain verification (add your domain in Customer Area → Settings → Apple Pay)
- **Google Pay** — requires merchant ID configuration
- **PayPal** — requires linking your PayPal Business account
- **Cash App Pay** — optional, US-only

### 4. Test with Adyen Test Cards

Use Adyen's test credentials before switching to live:

| Card Number           | Brand      | 3DS             |
| --------------------- | ---------- | --------------- |
| `4111 1111 1111 1111` | Visa       | No              |
| `5500 0000 0000 0004` | Mastercard | No              |
| `4212 3456 7891 0006` | Visa       | Yes (challenge) |

Expiry: any future date. CVV: `737`. See [Adyen test card numbers](https://docs.adyen.com/development-resources/testing/test-card-numbers/) for more.

### 5. Going Live

1. Apply for a live Adyen account if you don't have one.
2. Get live API key, client key, and merchant account from the live Customer Area.
3. Set `ADYEN_ENVIRONMENT=LIVE` and `NEXT_PUBLIC_ADYEN_ENVIRONMENT=live`.
4. Register the webhook endpoints on the live account with a new HMAC key.
5. Verify Apple Pay domain on the live account.

---

## PCI Compliance Notes

### Current Risk: `add-payment-method-dialog.tsx`

The `AddPaymentMethodDialog` component at `src/components/financials/add-payment-method-dialog.tsx` collects raw card numbers, expiry dates, and CVV codes in plain HTML `<Input>` fields. Even though the submit is simulated and the component is unused, its existence in the codebase represents a pattern that could be copied. Collecting raw card data in your own form fields means:

- Your integration **does not qualify for SAQ A** (the simplest PCI validation).
- You would need to complete **SAQ A-EP** or higher, which has significantly more requirements.
- Any QSA (Qualified Security Assessor) reviewing your integration would flag this.

**Mitigation:** Delete this component (Chunk 5). All card data collection should go through Adyen's secured, PCI-compliant iframes (Drop-in or Card Component), which keep sensitive data off your servers entirely.

### Adyen Web Components and PCI SAQ A

When using Adyen's Drop-in or individual Components:

- Card fields are rendered in Adyen-hosted iframes.
- Sensitive data never touches your client-side JavaScript or server.
- This qualifies your integration for **PCI SAQ A**, the simplest compliance level.
- The Sessions flow (which you are already using) is the recommended approach.

### Recommendations

1. **Never** build custom card input forms. Always use Adyen's secured components.
2. Ensure your CSP headers continue to allow Adyen domains (already configured in `next.config.mjs`).
3. Use `@adyen/adyen-web` styles (`adyen.css`) to avoid accidentally exposing field contents through custom CSS.
