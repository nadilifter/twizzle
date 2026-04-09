# Manual Adyen Credential & Webhook Setup

This guide covers how to create API credentials and webhooks in the Adyen Customer Area. For local webhook setup only, you can also use `scripts/provision-adyen.ts` (see [Part B](#part-b-per-environment-webhook-setup)).

> **Environments:**
>
> - Test: https://ca-test.adyen.com
> - Live: https://ca-live.adyen.com

---

## What's One-Time vs. Repeatable

| Task                                                                                 | When                                                                                                              | Who                                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Platform account structure** (company, merchant, balance platform, liable account) | One-time per Adyen environment (test / live)                                                                      | Adyen account manager + platform admin                        |
| **API credentials** (3 credentials with roles)                                       | One-time per Adyen environment — shared by all developers and deployed environments within that Adyen environment | Platform admin                                                |
| **Allowed origins on Checkout credential**                                           | One-time per Adyen environment, plus automatic per-org registration at runtime                                    | Platform admin (fixed subdomains); app handles org subdomains |
| **Webhook subscriptions** (4 subscriptions)                                          | Once per deployed environment (staging, production) **+ once per developer** for local ngrok URLs                 | Each developer (local), platform admin (staging/prod)         |
| **`.env` configuration**                                                             | Every developer, every deployed environment                                                                       | Each developer / deploy pipeline                              |

In practice:

- **Most developers** only need to do the **webhook + `.env`** steps — the API credentials and allowed origins are already set up in the test environment.
- **Going live in production** requires repeating the full setup (credentials, origins, webhooks) in the live Customer Area, since test and live are completely separate.

---

## Account Structure Reference

These values are already established. You do not need to create them — just reference them.

| Resource                  | Value                       | Notes                             |
| ------------------------- | --------------------------- | --------------------------------- |
| Company account           | `KirraCapital`              | Top-level Adyen entity            |
| Balance platform          | `UplifterLLC`               | Marketplace balance platform      |
| Liable balance account ID | `BA32957223227M5KTBSHJFVFL` | Platform's fee collection account |

### Merchant Accounts (per environment)

Each environment uses its own merchant account to isolate payment webhook traffic. Without this, all webhook subscriptions on the company account fire for every transaction across all environments.

| Environment | Merchant Account                   | `ADYEN_MERCHANT_ACCOUNT` value     | Status                                                            |
| ----------- | ---------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| Local       | `KirraCapital_Leapfrog_LOCAL_TEST` | `KirraCapital_Leapfrog_LOCAL_TEST` | Exists                                                            |
| Dev         | `KirraCapital_Leapfrog_DEV_TEST`   | `KirraCapital_Leapfrog_DEV_TEST`   | Exists                                                            |
| Staging     | `KirraCapital_Leapfrog_TEST`       | `KirraCapital_Leapfrog_TEST`       | Exists (legacy — the original merchant account, used for staging) |
| Production  | TBD (create in live Customer Area) | TBD                                | Needs creation                                                    |

> **Note:** Adyen automatically appends `_TEST` to merchant account codes created in the test Customer Area, and `_LIVE` in the live Customer Area. The staging account predates this naming convention, so it's just `_TEST` rather than `_STAGING_TEST`.

To create a new merchant account: Customer Area > **Settings > Merchant accounts > Create new**. Or ask your Adyen contact.

> **Balance platform webhooks** (Configuration, Transfer, Negative Balance) cannot be scoped per merchant account — they fire for all events on the `UplifterLLC` platform regardless. This means all environments receive all balance platform events. This is expected noise; see [Balance Platform Webhook Noise](#balance-platform-webhook-noise) for how to handle it.

---

## Part A: One-Time Setup (per Adyen environment)

> **Already done for test environments.** Skip to [Part B](#part-b-per-environment-webhook-setup) unless you are setting up the **live** environment for the first time or need to recreate credentials.

### A1: Create API Credentials

You need **three** separate API credentials, each scoped to a different Adyen API surface. These are **shared by all developers and all deployed environments** within the same Adyen environment (test or live). Do not create per-developer or per-local-environment credentials — everyone uses the same three keys. The only per-developer resource is webhook subscriptions (see [Part B](#part-b-per-environment-webhook-setup)).

#### Credential 1: Checkout / Payments (Company-level)

1. Log in to the [Customer Area](https://ca-test.adyen.com) and select the **KirraCapital** company account.
2. Go to **Developers > API credentials** and select the **Payments** tab.
3. Click **Create new credential** > **Web service user** > **Create credential**.
4. Set the **Description** (e.g., `leapfrog_test_payments`).
5. Under **Permissions**, enable these roles:
   - Checkout webservice role
   - Merchant PAL Webservice role
   - Merchant Recurring role
   - Management API — Webhooks read and write
   - Management API — API credentials read and write
   - Management API — Accounts read and write
   - Management API — Stores read and write
6. Under **Server settings > Authentication > API key**, click **Generate API key**. Copy it immediately — you cannot retrieve it later.
7. Under **Client settings**, copy the **Client key**.
8. Click **Save changes**.

| Env var                        | Value from this credential |
| ------------------------------ | -------------------------- |
| `ADYEN_API_KEY`                | The generated API key      |
| `NEXT_PUBLIC_ADYEN_CLIENT_KEY` | The client key             |

#### Credential 2: Balance Platform / Configuration (BalancePlatform-level)

1. In the Customer Area, go to **Balance Platforms > UplifterLLC**.
2. Go to **Developers > API credentials** and select the **Platforms** tab.
3. Click **Create new credential** > **Web service user** > **Create credential**.
4. Set the **Description** (e.g., `leapfrog_platforms_web_service_user`).
5. Under **Permissions**, enable these roles:
   - Balance Platform BCL role
   - Balance Platform Manage Account Holders
   - Balance Platform Manage Balance Accounts
   - Balance Platform Manage Transfer Instruments
6. Generate and copy the **API key**.
7. Click **Save changes**.

| Env var                  | Value from this credential |
| ------------------------ | -------------------------- |
| `ADYEN_PLATFORM_API_KEY` | The generated API key      |

#### Credential 3: Legal Entity Management (Company-scope)

1. Return to the **KirraCapital** company account level.
2. Go to **Developers > API credentials** and select the **Platforms** tab.
3. Click **Create new credential** > **Web service user** > **Create credential**.
4. Set the **Description** (e.g., `leapfrog_platforms_lem_user`).
5. Under **Permissions**, enable:
   - Legal Entity Management API — All
6. Generate and copy the **API key**.
7. Click **Save changes**.

| Env var             | Value from this credential |
| ------------------- | -------------------------- |
| `ADYEN_LEM_API_KEY` | The generated API key      |

#### Existing test credentials (reference)

These credentials already exist in the test environment. All developers share these keys.

| Credential | Username                                | Description                           |
| ---------- | --------------------------------------- | ------------------------------------- |
| Checkout   | `ws_396907@Company.KirraCapital`        | `leapfrog_test_payments`              |
| Platform   | `ws_508000@BalancePlatform.UplifterLLC` | `leapfrog_platforms_web_service_user` |
| LEM        | `ws_236609@Scope.Company_KirraCapital`  | `leapfrog_platforms_lem_user`         |

To regenerate a key for an existing credential: open the credential in the Customer Area > **Server settings > Authentication > API key** > **Generate API key**. The old key stays active for 24 hours.

---

### A2: Register Allowed Origins (Checkout credential only)

The Adyen Drop-in SDK requires each origin that loads it to be whitelisted on the Checkout credential. This is done once per environment; the app also registers org subdomains automatically at runtime during org signup.

1. Log in to the [Customer Area](https://ca-test.adyen.com) and select the **KirraCapital** company account.
2. Go to **Developers > API credentials** and open the Checkout credential (e.g., `ws_396907@Company.KirraCapital`).
3. Scroll down to the **Allowed origins** section (near the bottom of the credential page, below Client key).
4. In the text field, enter the origin and click **Add**. Repeat for each origin your environment needs:

| Environment | Origins to add                     |
| ----------- | ---------------------------------- |
| Local       | `http://localhost:3000`            |
| Staging     | `https://*.upliftergymnastics.com` |
| Production  | `https://*.uplifter.app`           |

5. Click **Save changes**. New origins take effect within a few seconds.

> Per-org subdomains (e.g., `https://acmegym.upliftergymnastics.com`) are registered automatically by the app during org signup. The backfill script `scripts/backfill-adyen-allowed-origins.ts` can register all existing orgs at once.

---

## Part B: Per-Environment Webhook Setup

> **Do this once for each deployed environment (dev, staging, production), and once per developer for local.** Webhook subscriptions are tied to specific URLs, so each environment (and each developer's ngrok tunnel) needs its own set.

> **Automated option for local:** Instead of creating webhooks manually, you can run:
>
> ```bash
> pnpm dlx tsx scripts/provision-adyen.ts --dev-tag <your-name>
> ```
>
> This creates all 4 webhooks pointing to your `WEBHOOK_TUNNEL_URL`, scopes the standard payment webhook to `KirraCapital_Leapfrog_LOCAL_TEST`, and outputs the HMAC keys. If the script works for you, skip to [Part C](#part-c-env-configuration-every-developer-every-environment).

You need **four** webhook subscriptions: one standard payment webhook and three balance platform webhooks.

### Webhook URLs by Environment

| Environment | Standard payment webhook URL                              | Balance platform webhook URL                                               |
| ----------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Local       | `{NGROK_URL}/api/webhooks/adyen`                          | `{NGROK_URL}/api/webhooks/adyen-balance-platform`                          |
| Staging     | `https://admin.upliftergymnastics.com/api/webhooks/adyen` | `https://admin.upliftergymnastics.com/api/webhooks/adyen-balance-platform` |
| Production  | `https://admin.uplifter.app/api/webhooks/adyen`           | `https://admin.uplifter.app/api/webhooks/adyen-balance-platform`           |

For local development, start an ngrok tunnel first:

```bash
ngrok http 3000
```

Then use the generated `https://xxxx.ngrok-free.app` URL as your base. Note that free ngrok URLs change every time you restart the tunnel — you'll need to update the webhook URLs in the Customer Area each time (or use a paid ngrok plan with a stable subdomain).

### B1: Standard Payment Webhook

1. In the Customer Area, select **KirraCapital** company account.
2. Go to **Developers > Webhooks** > **Payments** tab.
3. Click **Create new webhook** > **Standard webhook** > **Add**.
4. Configure:
   - **Enabled**: On
   - **Description**: `Standard payment events - <environment>` (e.g., `Standard payment events - local-name`)
   - **URL**: `{BASE_URL}/api/webhooks/adyen` (e.g., `https://xxxx.ngrok-free.app/api/webhooks/adyen` for local, `https://admin.uplifter.app/api/webhooks/adyen` for production)
   - **Method**: JSON
   - **Merchant accounts**: **Include only specific merchant accounts** > select only the merchant account for your environment (e.g., `KirraCapital_Leapfrog_LOCAL_TEST` for local). This prevents your webhook from firing for transactions on other environments.
5. Under **Security > HMAC Key**, click **Generate** and copy the key.
6. Click **Save configuration**.

**Env var produced:** `ADYEN_WEBHOOK_HMAC_KEY`

### B2: Balance Platform — Configuration Webhook

1. Go to **Balance Platforms > UplifterLLC**.
2. Go to **Developers > Webhooks** > **Platforms** tab.
3. Click **Create new webhook** and select the **UplifterLLC** balance platform.
4. Find **Configuration webhook** and click **Add**.
5. Configure:
   - **Enabled**: On
   - **Description**: `Configuration webhook - <environment>`
   - **URL**: `{BASE_URL}/api/webhooks/adyen-balance-platform`
   - **Method**: JSON
6. Under **Security > HMAC Key**, generate and copy the key.
7. Click **Save configuration**.

**Env var produced:** `ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY`

### B3: Balance Platform — Transfer Webhook

1. Click **Create new webhook** > select **UplifterLLC** > **Transfer webhook** > **Add**.
2. Configure:
   - **Description**: `Transfer webhook - <environment>`
   - **URL**: `{BASE_URL}/api/webhooks/adyen-balance-platform`
3. Generate and copy the **HMAC key**.
4. Click **Save configuration**.

**Env var produced:** `ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY`

### B4: Balance Platform — Negative Balance Compensation Warning Webhook

1. Click **Create new webhook** > select **UplifterLLC** > **Negative Balance Compensation Warning webhook** > **Add**.
2. Configure:
   - **Description**: `Negative Balance Compensation Warning - <environment>`
   - **URL**: `{BASE_URL}/api/webhooks/adyen-balance-platform`
3. Generate and copy the **HMAC key**.
4. Click **Save configuration**.

**Env var produced:** `ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY`

---

## Part C: `.env` Configuration (every developer, every environment)

Paste all values into your `.env` or `.env.local`. API keys come from the shared credentials (Part A); HMAC keys come from your webhook subscriptions (Part B).

```bash
# Adyen Checkout / Payments (shared credential — get key from team)
ADYEN_API_KEY='<paste key — escape $ as \$ inside single quotes>'
ADYEN_ENVIRONMENT=TEST
ADYEN_MERCHANT_ACCOUNT=KirraCapital_Leapfrog_LOCAL_TEST   # use your environment's merchant account
NEXT_PUBLIC_ADYEN_CLIENT_KEY='<paste client key>'
NEXT_PUBLIC_ADYEN_ENVIRONMENT=test

# Adyen Platform — Balance Platform (shared credential — get key from team)
ADYEN_PLATFORM_API_KEY='<paste key>'
ADYEN_BALANCE_PLATFORM=UplifterLLC
ADYEN_PLATFORM_MERCHANT_ACCOUNT=KirraCapital_Leapfrog_LOCAL_TEST  # match ADYEN_MERCHANT_ACCOUNT
ADYEN_LIABLE_BALANCE_ACCOUNT_ID=BA32957223227M5KTBSHJFVFL

# Adyen Legal Entity Management (shared credential — get key from team)
ADYEN_LEM_API_KEY='<paste key>'

# Webhook HMAC keys (from YOUR webhook subscriptions)
ADYEN_WEBHOOK_HMAC_KEY='<paste>'
ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY='<paste>'
ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY='<paste>'
ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY='<paste>'

# Local webhook tunnel (if using ngrok)
WEBHOOK_TUNNEL_URL=https://xxxx.ngrok-free.app
```

### Quoting Rules

Adyen API keys contain `$`, `;`, `^`, and other shell-sensitive characters. Follow these rules:

1. **Always wrap values in single quotes.**
2. **Escape every `$` as `\$`** — Next.js uses `@next/env` which chains `dotenv` → `dotenv-expand`. The `dotenv` parser preserves `\$` literally inside single quotes, then `dotenv-expand` recognizes `\$` as an escaped dollar and outputs `$`. Without the backslash, `dotenv-expand` treats `$VAR` as a variable reference and silently expands it to empty, corrupting the key.

```bash
# CORRECT — single quotes with \$ escaping
ADYEN_API_KEY='AQE...PU8=-i1iXhz{^)R;;\$A*.\$]5'

# WRONG — unescaped $ gets silently expanded to empty by dotenv-expand
ADYEN_API_KEY='AQE...PU8=-i1iXhz{^)R;;$A*.$]5'
```

**Important:** Do not put Adyen keys in `.env.local`. Next.js loads `.env.local` with higher priority, so changes to `.env` are silently ignored if both files define the same variable.

---

## Verify

Restart your dev server, then confirm:

1. **Checkout credential works**: The app can load the Adyen Drop-in on a checkout page without CORS errors.
2. **Platform credential works**: API calls to the Configuration API succeed (e.g., fetching account holders).
3. **LEM credential works**: API calls to the Legal Entity Management API succeed (e.g., creating a test legal entity).
4. **Webhooks arrive**: Send a test event from the Adyen Customer Area (Developers > Webhooks > select webhook > Test configuration) and confirm your server receives it.

---

## Quick-Start for New Developers

If the test environment is already set up (it is), here's the minimum path:

1. **Get the shared API keys** from a teammate or secrets manager — you need `ADYEN_API_KEY`, `NEXT_PUBLIC_ADYEN_CLIENT_KEY`, `ADYEN_PLATFORM_API_KEY`, and `ADYEN_LEM_API_KEY`.
2. **Set up ngrok** and start a tunnel (`ngrok http 3000`).
3. **Create a standard payment webhook** in the [test Customer Area](https://ca-test.adyen.com) pointing to your ngrok URL, scoped to `KirraCapital_Leapfrog_LOCAL_TEST` (see [B1](#b1-standard-payment-webhook)).
4. **Optionally create balance platform webhooks** only if you're testing onboarding/payout flows (see [B2–B4](#b2-balance-platform--configuration-webhook)). These will receive noise from other environments — see [Balance Platform Webhook Noise](#balance-platform-webhook-noise).
5. **Copy the HMAC keys** from the webhooks you created.
6. **Fill in your `.env`** using the template in [Part C](#part-c-env-configuration-every-developer-every-environment). Set `ADYEN_MERCHANT_ACCOUNT=KirraCapital_Leapfrog_LOCAL_TEST`.
7. **Restart your dev server** and verify.

---

## Balance Platform Webhook Noise

Balance platform webhooks (Configuration, Transfer, Negative Balance) are scoped to the `UplifterLLC` balance platform, **not** to a merchant account. Every subscription on the platform fires for every event — there is no way to filter them per environment.

This means:

- When staging triggers an onboarding event, your local webhook also receives it (and vice versa).
- If your local HMAC keys don't match the subscription that sent the event, you'll see `401` errors. These are harmless — Adyen retries a few times and stops.

**Recommendations:**

- **Only create balance platform webhooks locally when actively testing** onboarding, payout, or transfer flows. Disable or delete them when done.
- **Ignore 401s from cross-environment deliveries** — they don't affect functionality.
- The standard payment webhook does **not** have this problem if you scope it to your environment's merchant account (see [B1](#b1-standard-payment-webhook)).

---

## Troubleshooting

| Symptom                                    | Cause                                                                                                                 | Fix                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 401 Unauthorized on all API calls          | API key corrupted by unescaped `$` in `.env` (expanded to empty by `dotenv-expand`) or `.env.local` overriding `.env` | Wrap in single quotes and escape `$` as `\$`. Delete `.env.local` if it exists. |
| CORS error on checkout page                | Origin not registered on Checkout credential                                                                          | Add origin in Customer Area > API credential > Allowed origins                  |
| Webhook test fails                         | URL not publicly reachable                                                                                            | Ensure ngrok is running and URL is correct                                      |
| Webhooks stop arriving after ngrok restart | Free ngrok URL changed                                                                                                | Update webhook URLs in Customer Area, or use a paid stable subdomain            |
| "No merchant account" error                | `ADYEN_MERCHANT_ACCOUNT` not set                                                                                      | Add `ADYEN_MERCHANT_ACCOUNT=KirraCapital_Leapfrog_TEST` to `.env`               |
| Balance Platform API returns 403           | Using Checkout credential instead of Platform credential                                                              | Use `ADYEN_PLATFORM_API_KEY` for Configuration/Transfers API calls              |

---

## References

- [Adyen API Credentials docs](https://docs.adyen.com/development-resources/api-credentials)
- [Adyen Webhook Configuration docs](https://docs.adyen.com/development-resources/webhooks/configure-and-manage)
- [Phase 0: Prerequisites](./phase-0-prerequisites.md) — full checklist with account IDs and credential usernames
- [Adyen Platform README](./README.md) — architecture overview and environment variables
