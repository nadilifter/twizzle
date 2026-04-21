# SMS Toll-Free Verification

How to provision new toll-free phone numbers for the SMS pool and manage their Twilio toll-free verification (TFV).

---

## Overview

Uplifter uses a pool of Twilio toll-free numbers (`SMS_PHONE_POOL`) to route SMS conversations. Each number must:

1. Be **purchased** in Twilio
2. Be **added** to the Messaging Service
3. Have an **approved toll-free verification** (TFV)

Only numbers with `TWILIO_APPROVED` status are used for sending. The app checks this automatically via `fetchVerifiedTollFreeNumbers()` in `src/lib/twilio.ts`.

---

## Canonical flow (scripts)

All provisioning and resubmission happens through two scripts. They read canonical TFV field values from env vars — there is no longer any hardcoded personal information in this file or elsewhere.

| Script                                                                                        | Purpose                                                                 |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`scripts/provision-tollfree-number.ts`](../scripts/provision-tollfree-number.ts)             | Search → purchase → attach to Messaging Service → submit TFV            |
| [`scripts/resubmit-tollfree-verifications.ts`](../scripts/resubmit-tollfree-verifications.ts) | Bulk-resubmit all `TWILIO_REJECTED` verifications with corrected fields |

Both import from [`scripts/lib/tollfree-fields.ts`](../scripts/lib/tollfree-fields.ts), the single source of truth for TFV submission copy (business identity, opt-in disclosure, use-case summary).

### Required env vars

Copy from `.env.example` and fill in for the target Twilio account (non-prod, prod, etc.). The scripts hard-fail before any Twilio API call if any of these are missing or look personal.

```bash
# Twilio credentials
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...
TWILIO_CUSTOMER_PROFILE_SID=BU...  # Trust Hub > Customer Profiles

# Authorized rep of the LLC (Twilio requires a real person)
TWILIO_TFV_BUSINESS_CONTACT_FIRST_NAME=Authorized
TWILIO_TFV_BUSINESS_CONTACT_LAST_NAME=Representative

# MUST be role-based — not @gmail/@outlook/etc., not containing first/last name
TWILIO_TFV_BUSINESS_CONTACT_EMAIL=compliance@uplifterinc.com
TWILIO_TFV_NOTIFICATION_EMAIL=compliance@uplifterinc.com

# Business phone line (NOT a personal cell)
TWILIO_TFV_BUSINESS_CONTACT_PHONE=+18005551234

# Public disclosure page that renders the live <SmsConsentCheckbox> component.
# See "Why a dedicated opt-in URL?" below for the reason this is preferred
# over submitting the actual signup page. Must be reachable without auth.
# Localhost and our auth-gated dev subdomain are blocked by the pre-flight.
TWILIO_TFV_OPTIN_URL_PRIMARY=https://upliftergymnastics.com/sms-opt-in
# Optional second URL — leave unset unless there's a specific reason
# TWILIO_TFV_OPTIN_URL_SECONDARY=
```

See [`scripts/lib/tollfree-fields.ts`](../scripts/lib/tollfree-fields.ts) `validateEnv` for the complete validation behavior.

### Provisioning a new number

```bash
# Dry-run first — prints the exact payload Twilio would receive, no API calls
DRY_RUN=1 pnpm dlx tsx scripts/provision-tollfree-number.ts

# Real run — picks the first available toll-free number
pnpm dlx tsx scripts/provision-tollfree-number.ts

# Real run with a specific number
pnpm dlx tsx scripts/provision-tollfree-number.ts --number +18881234567
```

After a successful run:

1. Add the new E.164 number to `SMS_PHONE_POOL` in the target environment (comma-separated).
2. Redeploy (or wait for the hourly pool refresh in `src/lib/sms-number-pool.ts`).
3. The pool manager holds back numbers until Twilio flips status to `TWILIO_APPROVED`, so there is no risk of routing traffic through an unverified number.
4. Monitor Twilio Console → Trust Hub → Toll-Free Verifications. Approval typically takes 2–5 business days.

### Resubmitting rejected numbers

When Twilio rejects a TFV, you have **7 days** to resubmit in the priority queue before it falls back to the normal queue.

```bash
# Dry-run
DRY_RUN=1 pnpm dlx tsx scripts/resubmit-tollfree-verifications.ts

# Resubmit all TWILIO_REJECTED verifications at once
pnpm dlx tsx scripts/resubmit-tollfree-verifications.ts

# Resubmit a single verification by HH SID
pnpm dlx tsx scripts/resubmit-tollfree-verifications.ts --sid HHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Checking verification status

```bash
curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://messaging.twilio.com/v1/Tollfree/Verifications?PageSize=50" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for v in data['verifications']:
    print(f\"{v['tollfree_phone_number']:16s} | {v['status']:16s} | {v['sid']}\")"
```

---

## Why a dedicated opt-in URL?

Our real guardian signup flow at `<club>.upliftergymnastics.com/signup` is a 3-step wizard: `email → verify code → complete details`. The SMS consent checkbox only renders on step 3, which a Twilio reviewer cannot reach — they can't complete the email verification step without a real mailbox.

Rather than submit a URL that appears empty on first load (guaranteeing another rejection), we submit a dedicated disclosure page at `/sms-opt-in` that:

- Renders the live `<SmsConsentCheckbox>` component (the exact same control guardians see at step 3 of signup)
- Documents the SMS program (message types, frequency, rates, STOP/HELP behavior)
- Describes where the checkbox appears in the real flow so reviewers have full context

The page is implemented in [`src/app/sms-opt-in/page.tsx`](../src/app/sms-opt-in/page.tsx). It renders the live component rather than a screenshot, so the disclosure copy cannot drift from what real users see. If you ever change the checkbox label copy, bump `SMS_CONSENT_VERSION` in [`src/lib/sms-consent.ts`](../src/lib/sms-consent.ts) AND coordinate a fresh TFV submission — the reviewer is looking at this URL for the canonical disclosure.

---

## Environments and accounts

Uplifter has separate Twilio accounts for non-prod and prod. Each has its own:

- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_CUSTOMER_PROFILE_SID` (per-account Trust Hub profile)
- Pool of toll-free numbers and their TFV records

**Dev (`upliftergymnastics-dev.com`) is not publicly reachable**, so it must not be used as a `TWILIO_TFV_OPTIN_URL_*`. Dev Twilio numbers still point their opt-in URLs at the publicly reachable non-prod host (`upliftergymnastics.com`), since the UI renders identically across envs and Twilio only needs to load the checkbox, not process a real signup.

---

## Handling rejections

Common Twilio TFV rejection codes for our flow:

| Code  | Meaning                                                                | Fix                                                                                                                      |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 30475 | Opt-in cannot be combined with other agreements / required for service | Confirm Phase 3 UI is deployed on the OPTIN_URL host (standalone unchecked checkbox below the Terms checkbox). Resubmit. |
| 30513 | Opt-in not sufficient (legacy reason code)                             | Usually same remediation as 30475 — ensure OPTIN_URL serves a visible unchecked checkbox, not a privacy policy page.     |
| 30447 | Phone number not provisioned to Twilio                                 | Something went wrong in the purchase step; use the Twilio Console to verify the number exists before resubmitting.       |

Read `rejection_reason` on the HH resource for details:

```bash
curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://messaging.twilio.com/v1/Tollfree/Verifications/HHxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  | python3 -m json.tool
```

---

## SMS consent enforcement (downstream)

Outbound SMS is gated on `User.smsConsentAt` — see `src/lib/sms-service.ts`. The `AdditionalInformation` field of our TFV submission describes this gate; if it ever stops being true, resubmissions will be rejected with 30475. See the plan at `~/.claude/plans/streamed-dancing-popcorn.md` for the full phase breakdown.

---

## Relevant code

| What                              | Where                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| Canonical TFV fields + validation | [`scripts/lib/tollfree-fields.ts`](../scripts/lib/tollfree-fields.ts)                         |
| Provisioning script               | [`scripts/provision-tollfree-number.ts`](../scripts/provision-tollfree-number.ts)             |
| Resubmission script               | [`scripts/resubmit-tollfree-verifications.ts`](../scripts/resubmit-tollfree-verifications.ts) |
| Pool manager                      | [`src/lib/sms-number-pool.ts`](../src/lib/sms-number-pool.ts)                                 |
| Verified-pool fetcher             | `fetchVerifiedTollFreeNumbers()` in [`src/lib/twilio.ts`](../src/lib/twilio.ts)               |
| Inbound webhook                   | [`src/app/api/twilio/webhook/route.ts`](../src/app/api/twilio/webhook/route.ts)               |
| Consent disclosure copy           | [`src/components/sms-consent-copy.ts`](../src/components/sms-consent-copy.ts)                 |
| Superadmin pool dashboard         | [`src/app/superadmin/usage/page.tsx`](../src/app/superadmin/usage/page.tsx)                   |

---

## Twilio API reference

- [Toll-free verification resource](https://www.twilio.com/docs/messaging/api/tollfree-verification-resource)
- [Error 30475](https://www.twilio.com/docs/api/errors/30475)
- [Error 30513](https://www.twilio.com/docs/api/errors/30513)
- [Available phone numbers](https://www.twilio.com/docs/phone-numbers/api/availablephonenumber-tollfree-resource)
- [Incoming phone numbers](https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource)
