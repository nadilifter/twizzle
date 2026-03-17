# Phase 1: Database Schema and Adyen Platform API Client

**Type**: Backend foundation (schema migration + new library module)
**Depends on**: Phase 0 (environment variables configured)
**Blocks**: Phases 2, 3
**Estimated effort**: 1-2 days
**Risk to existing functionality**: None -- adds new model and new file, does not modify any existing code

## Overview

Add the `AdyenPlatformAccount` Prisma model to map each Organization to its Adyen platform entities, and create the `adyen-platform.ts` API client module that wraps the LEM, Configuration, and Management APIs.

## Step 1A: Prisma Schema Migration

### File to modify: `prisma/schema.prisma`

#### 1. Add the `AdyenPlatformAccount` model

Insert after the `OrganizationPaymentMethod` model (around line 2939 in the current schema, after the `@@index([shopperReference])` closing brace):

```prisma
// ============================================
// Adyen Platform (Balance Platform / Marketplace)
// ============================================

model AdyenPlatformAccount {
  id             String @id @default(cuid())
  organizationId String @unique

  // Adyen entity IDs (populated progressively during onboarding)
  legalEntityId    String  @unique
  businessLineId   String?
  accountHolderId  String? @unique
  balanceAccountId String? @unique
  storeId          String?
  storeReference   String?

  // Onboarding
  onboardingStatus   AdyenOnboardingStatus @default(PENDING_HOSTED)
  verificationStatus String?
  capabilities       Json?

  // Sweep
  sweepId              String?
  transferInstrumentId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([legalEntityId])
  @@index([accountHolderId])
}

enum AdyenOnboardingStatus {
  PENDING_HOSTED
  IN_PROGRESS
  AWAITING_DATA
  IN_REVIEW
  VERIFIED
  REJECTED
}
```

#### 2. Add the inverse relation on the `Organization` model

In the `Organization` model, add this line in the relations section (near the other financial relations around line 66):

```prisma
  // Adyen Platform
  adyenPlatformAccount AdyenPlatformAccount?
```

Insert it after the `organizationPaymentMethods` line:
```
  organizationPaymentMethods OrganizationPaymentMethod[]

  // Adyen Platform
  adyenPlatformAccount AdyenPlatformAccount?
```

#### 3. Run the migration

```bash
pnpm db:migrate
```

Migration name suggestion: `add_adyen_platform_account`

### Verification

- Run `pnpm db:migrate` -- migration should apply cleanly
- Run `pnpm db:check` -- schema should show no drift
- Start the dev server -- no build errors
- Existing tests pass -- no regressions

---

## Step 1B: Adyen Platform API Client Module

### File to create: `src/lib/adyen-platform.ts`

This module wraps the Adyen LEM, Configuration, and Management APIs following the same lazy-initialization pattern used in `src/lib/adyen.ts`.

### Architecture Notes

The existing `src/lib/adyen.ts` uses:
- `require("@adyen/api-library")` for lazy loading (avoids build-time errors)
- Module-level singleton caching (`let _checkoutApi: any = null`)
- `any` types because Adyen client types are only available at runtime via `require()`
- `getAdyenClient()` that reads `ADYEN_API_KEY` and `ADYEN_ENVIRONMENT`

This module uses TWO separate Adyen API keys (neither is the checkout `ADYEN_API_KEY`):

1. **`ADYEN_LEM_API_KEY`** (`ws_236609@Scope.Company_KirraCapital`) -- for the Legal Entity Management API (legal entities, business lines, onboarding links)
2. **`ADYEN_PLATFORM_API_KEY`** (`ws_508000@BalancePlatform.UplifterLLC`) -- for the Configuration API (account holders, balance accounts, sweeps) and Transfers API

Each API surface requires its own Adyen `Client` instance because they use different credentials.

### Functions to Implement

```typescript
// --- Client initialization (two separate clients for different credential scopes) ---

function getLemClient(): any
// Creates an Adyen Client using ADYEN_LEM_API_KEY (required)
// Scoped to Company_KirraCapital -- used for LEM API only
// Throws if ADYEN_LEM_API_KEY is not set

function getPlatformClient(): any
// Creates an Adyen Client using ADYEN_PLATFORM_API_KEY (required)
// Scoped to BalancePlatform.UplifterLLC -- used for Configuration + Transfers APIs
// Throws if ADYEN_PLATFORM_API_KEY is not set

function getLemApi(): any
// Returns LegalEntityManagementAPI instance
// Uses: new LegalEntityManagementAPI(getLemClient())

function getConfigApi(): any
// Returns BalancePlatformAPI instance
// Uses: new BalancePlatformAPI(getPlatformClient())

function getManagementApi(): any
// Returns ManagementAPI instance
// Uses: new ManagementAPI(getPlatformClient())

export function isPlatformConfigured(): boolean
// Returns true if ADYEN_BALANCE_PLATFORM, ADYEN_PLATFORM_API_KEY, and ADYEN_LEM_API_KEY are all set

// --- Legal Entity Management ---

export async function createLegalEntity(data: {
  type: "organization";
  organization: {
    legalName: string;
    registeredAddress: {
      street: string;
      city: string;
      stateOrProvince: string;
      postalCode: string;
      country: string; // ISO 3166-1 alpha-2 (US, CA)
    };
  };
}): Promise<{ id: string; [key: string]: any }>
// Calls: POST /legalEntities via LEM API
// Returns: The created legal entity including its id

export async function createBusinessLine(data: {
  legalEntityId: string;
  industryCode: string;    // NAICS code
  service: "paymentProcessing";
  salesChannels: Array<{ source: string }>;
  webData?: Array<{ webAddress: string }>;
}): Promise<{ id: string; [key: string]: any }>
// Calls: POST /businessLines via LEM API

export async function generateOnboardingLink(
  legalEntityId: string,
  redirectUrl: string,
  themeId?: string,
): Promise<{ url: string; [key: string]: any }>
// Calls: POST /legalEntities/{id}/onboardingLinks via LEM API
// themeId defaults to process.env.ADYEN_ONBOARDING_THEME_ID if set, otherwise omitted (Adyen default)

// --- Configuration (Balance Platform) API ---

export async function createAccountHolder(data: {
  legalEntityId: string;
  description?: string;
  capabilities?: Record<string, { requested: boolean; requestedLevel: string }>;
}): Promise<{ id: string; [key: string]: any }>
// Calls: POST /accountHolders via Configuration API
// Default capabilities to request:
//   receivePayments: { requested: true, requestedLevel: "notApplicable" }
//   sendToTransferInstrument: { requested: true, requestedLevel: "notApplicable" }
//   receiveFromBalanceAccount: { requested: true, requestedLevel: "notApplicable" }

export async function createBalanceAccount(data: {
  accountHolderId: string;
  description?: string;
}): Promise<{ id: string; [key: string]: any }>
// Calls: POST /balanceAccounts via Configuration API

export async function createSweep(
  balanceAccountId: string,
  data: {
    counterparty: { transferInstrumentId: string };
    type: "push";
    schedule: { type: string }; // "daily", "weekly", etc.
    priorities: string[];       // ["regular"]
    currency: string;           // "USD"
  }
): Promise<{ id: string; [key: string]: any }>
// Calls: POST /balanceAccounts/{id}/sweeps via Configuration API

export async function getAccountHolder(
  accountHolderId: string
): Promise<{ id: string; capabilities: any; [key: string]: any }>
// Calls: GET /accountHolders/{id} via Configuration API

// --- Management API ---

export async function createStore(data: {
  merchantId: string;  // ADYEN_PLATFORM_MERCHANT_ACCOUNT
  description: string;
  address: {
    country: string;
    line1: string;
    city: string;
    stateOrProvince: string;
    postalCode: string;
  };
  phoneNumber: string;
  reference: string;
}): Promise<{ id: string; reference: string; [key: string]: any }>
// Calls: POST /stores via Management API
```

### Important Implementation Details

1. **Error handling**: Each function should catch errors, log them with context (the function name and key parameters), and re-throw. Match the pattern in `src/lib/adyen.ts`.

2. **No `refundPayment` or `createTransfer` yet**: These are deferred to Phase 4 and Phase 6 respectively. Do not implement them now.

3. **API key resolution**: Three separate clients are needed:
   - `getLemClient()` uses `ADYEN_LEM_API_KEY` (Company-scoped `ws_236609@Scope.Company_KirraCapital`). Used by `getLemApi()` for legal entities, business lines, onboarding links.
   - `getPlatformClient()` uses `ADYEN_PLATFORM_API_KEY` (BalancePlatform-scoped `ws_508000@BalancePlatform.UplifterLLC`). Used by `getConfigApi()` for account holders, balance accounts, sweeps.
   - `getManagementClient()` uses `ADYEN_API_KEY` (Company-level). Used by `getManagementApi()` for stores. The Management API is company-scoped, so the BalancePlatform key returns 401.
   - Throw a clear error if any key is missing when the respective client is requested.

4. **The `@adyen/api-library` v30 API classes**:
   - `LegalEntityManagementAPI` -- exposes `.LegalEntitiesApi`, `.BusinessLinesApi`, `.HostedOnboardingApi`
   - `BalancePlatformAPI` -- exposes `.AccountHoldersApi`, `.BalanceAccountsApi`, `.PlatformApi`
   - `ManagementAPI` -- exposes `.AccountStoreLevelApi`

   You will need to verify exact method names by checking the library source or TypeScript definitions. The `require()` pattern means these are not statically typed.

5. **Do not modify `src/lib/adyen.ts`** in this phase. That file handles checkout sessions, payment links, and tokenization. It will be modified in Phase 5 (Recurring Charges).

### Verification

- Import the module in a test file or script
- Call `isPlatformConfigured()` -- should return true if Phase 0 env vars are set
- Call `createLegalEntity()` with test data against the Adyen sandbox -- should return a legal entity ID
- Verify no build errors when importing the module
- Verify existing tests still pass
