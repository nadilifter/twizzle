# Phase 0: Adyen Account Prerequisites and Environment Configuration

**Type**: Admin / configuration (no code changes)
**Depends on**: Nothing
**Blocks**: All subsequent phases
**Estimated effort**: 1-2 days of admin coordination with Adyen

## Overview

Before any development can begin, the Kirra Adyen balance platform must be fully configured with the correct API credentials, webhook endpoints, and onboarding themes. This phase is entirely manual work done in the Adyen Customer Area and local environment files.

## Prerequisites Checklist

### 0.1 Confirm Balance Platform Setup -- DONE

**Who**: Adyen account manager / Kirra admin
**Where**: Adyen Customer Area

- Test: https://ca-test.adyen.com
- Production: https://ca-live.adyen.com

**Values obtained**:

| Variable                          | Value                        | Notes                                                                                                                                                        |
| --------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Company Account                   | `KirraCapital`               | Legal entity: Kirra Capital, US                                                                                                                              |
| `ADYEN_BALANCE_PLATFORM`          | `UplifterLLC`                | Balance platform ID                                                                                                                                          |
| `ADYEN_PLATFORM_MERCHANT_ACCOUNT` | `KirraCapital_Leapfrog_TEST` | Staging merchant account (legacy name). See [manual setup guide](manual-credential-setup.md#merchant-accounts-per-environment) for per-environment accounts. |
| Liable balance account ID         | `BA32957223227M5KTBSHJFVFL`  | Platform's own balance account for collecting fees                                                                                                           |

---

### 0.2 Create/Update API Credentials -- DONE

**Where**: Adyen Customer Area > Developers > API credentials

Three separate credentials are used, each scoped to a different Adyen API surface:

**Credential 1: Checkout / Payments** (Company-level)

- **Username**: `ws_396907@Company.KirraCapital`
- **Description**: `leapfrog_test_payments`
- **Shopper interactions**: Omnichannel
- **Client key**: `test_EB5HMWNJJNGENK2OMNZK6LMU6IPHBN4O`
- **Used for**: Checkout API, Payment Links, Recurring payments, standard webhooks

**Credential 2: Balance Platform / Configuration** (BalancePlatform-level)

- **Username**: `ws_508000@BalancePlatform.UplifterLLC`
- **Description**: `leapfrog_platforms_web_service_user`
- **Scope**: BalancePlatform account `UplifterLLC` and all associated account holders
- **Used for**: Configuration API (Account Holders, Balance Accounts, Sweeps), Transfers API

**Credential 3: Legal Entity Management** (Company-scope)

- **Username**: `ws_236609@Scope.Company_KirraCapital`
- **Description**: `leapfrog_platforms_lem_user`
- **Scope**: Company `KirraCapital` and all associated account holders
- **Used for**: LEM API (Legal Entities, Business Lines, Onboarding Links)

**Values**:

| Variable                       | Credential | Description                                          |
| ------------------------------ | ---------- | ---------------------------------------------------- |
| `ADYEN_API_KEY`                | 1          | Checkout/payments key                                |
| `ADYEN_PLATFORM_API_KEY`       | 2          | Configuration/Transfers key (BalancePlatform-scoped) |
| `ADYEN_LEM_API_KEY`            | 3          | Legal Entity Management key (Company-scoped)         |
| `NEXT_PUBLIC_ADYEN_CLIENT_KEY` | 1          | `test_EB5HMWNJJNGENK2OMNZK6LMU6IPHBN4O`              |

All API keys are set in `.env` only (never committed).

---

### 0.3 Create Hosted Onboarding Theme -- DEFERRED

Adyen hosted onboarding supports generating links without a custom theme (uses Adyen's default branding). We will skip custom theme creation for now and pass no `themeId` when generating onboarding links.

This can be revisited later to add Leapfrog/Kirra branding to the onboarding experience.

| Variable                    | Value              | Notes                     |
| --------------------------- | ------------------ | ------------------------- |
| `ADYEN_ONBOARDING_THEME_ID` | Not set (optional) | Omit to use Adyen default |

---

### 0.4 Configure Balance Platform Webhooks

> **Automated alternative**: Webhook creation and HMAC key generation can now be done programmatically with `npx tsx scripts/provision-adyen-staging.ts`. See [Staging / Production Provisioning](README.md#staging--production-provisioning) for details.

**Where**: Adyen Customer Area > Balance Platforms > UplifterLLC > Webhooks

Adyen requires **three separate webhook subscriptions** for different event categories. Each generates its own HMAC key.

**Subscription 1: Configuration webhook**

- Events: account holder created/updated, balance account created/updated
- Used for: onboarding status tracking (Phase 3)
- URL: `{BASE_URL}/api/webhooks/adyen-balance-platform`

**Subscription 2: Transfer webhook**

- Events: transfer created/updated
- Used for: payment settlement tracking, sweep/payout tracking (Phases 4-8)
- URL: `{BASE_URL}/api/webhooks/adyen-balance-platform`

**Subscription 3: Negative Balance Compensation Warning Webhook**

- Events: negative balance compensation scheduled
- Used for: negative balance alerts (Phase 7)
- URL: `{BASE_URL}/api/webhooks/adyen-balance-platform`

All three point to the same endpoint. The handler dispatches by the `type` field in the payload.

**URL values**:

- Production: `https://admin.yourdomain.com/api/webhooks/adyen-balance-platform`
- Staging: `https://admin.staging.yourdomain.com/api/webhooks/adyen-balance-platform`
- Local testing: ngrok URL + `/api/webhooks/adyen-balance-platform`

**HMAC keys**: Each subscription generates a separate HMAC key. Store all three:

| Variable                             | Webhook subscription                  |
| ------------------------------------ | ------------------------------------- |
| `ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY`   | Configuration webhook                 |
| `ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY` | Transfer webhook                      |
| `ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY`   | Negative Balance Compensation Warning |

The webhook handler will try all three keys when verifying signatures (the payload's `type` field identifies which subscription sent it, but we verify against all keys for robustness).

**Important**: These are SEPARATE from the existing payment webhook at `/api/webhooks/adyen` which handles `AUTHORISATION`, `REFUND`, etc.

---

### 0.5 Update Environment Variables

**File**: `.env.example` and all environment `.env` files

**Already done** -- `.env.example` has been updated with the new variables:

```env
# Adyen Platform (Balance Platform / Marketplace model)
# Company account: KirraCapital | Balance platform: UplifterLLC
ADYEN_BALANCE_PLATFORM=UplifterLLC
ADYEN_PLATFORM_MERCHANT_ACCOUNT=KirraCapital_Leapfrog_TEST
# Hosted onboarding theme ID (optional -- omit to use Adyen default)
# ADYEN_ONBOARDING_THEME_ID=
# Balance platform webhook HMAC keys (one per subscription type)
ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY=your-config-webhook-hmac-key
ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY=your-transfer-webhook-hmac-key
ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY=your-negbal-webhook-hmac-key
# Configuration/Transfers API key (ws_508000@BalancePlatform.UplifterLLC)
ADYEN_PLATFORM_API_KEY=your-platform-api-key
# Legal Entity Management API key (ws_236609@Scope.Company_KirraCapital)
ADYEN_LEM_API_KEY=your-lem-api-key
```

**Existing variables**:

- `ADYEN_API_KEY` -- checkout/payments key (`ws_396907@Company.KirraCapital`)
- `ADYEN_MERCHANT_ACCOUNT` = `KirraCapital_Leapfrog_TEST`
- `ADYEN_ENVIRONMENT` = `TEST`
- `NEXT_PUBLIC_ADYEN_CLIENT_KEY` = `test_EB5HMWNJJNGENK2OMNZK6LMU6IPHBN4O`
- `ADYEN_WEBHOOK_HMAC_KEY` (existing payment webhook HMAC)

---

### 0.6 Verify Test Environment Access

**Manual validation before writing any code**:

1. Use the [Adyen API Explorer](https://docs.adyen.com/api-explorer/) or Postman to test:
   - `POST /legalEntities` with your API key -- create a test legal entity
   - `GET /accountHolders` -- verify Configuration API access
   - `POST /stores` -- verify Management API access
2. Confirm webhook test delivery:
   - Send a test event from Adyen Customer Area to your staging/ngrok URL
   - Verify the request arrives (check server logs)
3. Confirm the existing checkout flow still works (no regression from API key changes)

## Deliverable

A completed checklist document with all IDs and keys filled in, confirming:

- [x] Balance platform ID obtained (`UplifterLLC`)
- [x] Platform merchant account ID obtained (`KirraCapital_Leapfrog_TEST`)
- [x] API credentials obtained (triple-key: checkout + platform + LEM)
- [x] Onboarding theme -- deferred (using Adyen default)
- [x] Balance platform webhooks configured (3 subscriptions) and HMAC keys obtained
- [x] Liable balance account ID obtained (`BA32957223227M5KTBSHJFVFL`)
- [x] Environment variables added to `.env.example`
- [x] Test API call to `POST /legalEntities` succeeds in sandbox (created LE32CQH223227H5P3NMN6C3XS)
- [x] Test API call to Configuration API succeeds (created AH32CSF22322BF5P3NMWP9R7F)
- [x] Test API call to Checkout API succeeds (paymentMethods returned)
- [x] Test webhook delivery to ngrok endpoint succeeds (11 events received, all HMAC verified PASS)
- [x] Existing checkout flow -- was never functional; not a regression from platform setup
