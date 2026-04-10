# Plan: Billing Address on Org Signup Flow

## Overview

The payment page (`/org-signup/payment`) currently auto-creates the Adyen session on mount with no billing address. We'll add a billing address card **above** the Adyen payment form with a "Use same address as my organization" checkbox (pre-checked by default). After the user confirms their billing address, the Adyen session is created — with the billing address included.

---

## Step 1 — `src/lib/adyen.ts`

Add an `AdyenBillingAddress` interface and `billingAddress` param to `createTokenizationSession()`. Adyen's `/sessions` API expects:

```
billingAddress.street, .houseNumberOrName, .city, .stateOrProvince, .postalCode, .country
```

We'll map our single `street` field to `street`, use `"N/A"` for the required `houseNumberOrName` (standard pattern since our UI doesn't split them), and map `stateProvince` → `stateOrProvince`.

---

## Step 2 — `src/app/api/org-signup/payment-session/route.ts`

Extend the Zod schema to accept a required `billingAddress` object and forward it to `createTokenizationSession()`.

---

## Step 3 — `src/app/org-signup/payment/page.tsx` (main work)

**State changes:**

- `billingAddress` object (street, city, stateProvince, postalCode, country) — initialized to empty, will be pre-filled from `signupData`'s org address once loaded
- `useSameAddress: boolean` — default `true`
- `billingAddressConfirmed: boolean` — default `false`, gates when Adyen form appears

**New UX flow:**

1. Page loads → reads `signupData` from sessionStorage → pre-populates billing address state from org address fields
2. Shows **Billing Address card** (similar to checkout billing address):
   - Checkbox at top: "Use same address as my organization" (checked)
   - When checked: fields show the org address, all disabled (read-only preview)
   - When unchecked: fields become editable for a different billing address, with same `StateProvinceCombobox` + country select as org step
   - "Continue to Payment" button at bottom of card
3. On "Continue to Payment":
   - Validates billing address fields are filled
   - Calls `createSession(billingAddress)` which passes address to the API → Adyen
   - Transitions to Adyen payment form (same as now)
4. Adyen payment section only renders after `billingAddressConfirmed === true`

**Visual result:** The page will have three cards stacked:

- Plan Summary (unchanged)
- Billing Address (new — looks like checkout's billing address section)
- Payment Method (only shows after billing address confirmed)

---

## What's NOT changing

- The org signup steps 1–4 (`/org-signup/page.tsx`) — the address collected in step 2 is for the organization's physical/facility address and stays as-is
- The review page — doesn't need billing address
- The checkout page — separate flow, unaffected
- `createPaymentSession()` (used by checkout) — only `createTokenizationSession()` needs updating

---

## Adyen Billing Address Field Mapping

| Our field       | Adyen field                                  |
| --------------- | -------------------------------------------- |
| `street`        | `billingAddress.street`                      |
| _(none)_        | `billingAddress.houseNumberOrName` = `"N/A"` |
| `city`          | `billingAddress.city`                        |
| `stateProvince` | `billingAddress.stateOrProvince`             |
| `postalCode`    | `billingAddress.postalCode`                  |
| `country`       | `billingAddress.country`                     |
