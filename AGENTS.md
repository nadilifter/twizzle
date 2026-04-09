# Agents Guide

This file gives AI coding agents (Claude Code, Cursor, Copilot, etc.) the context needed to work effectively in this codebase without making architectural mistakes or breaking tenant isolation.

Read this before making changes. Cross-reference with `ARCHITECTURE.md` for deep dives.

---

## What This Project Is

**Uplifter** is a multi-tenant SaaS platform for sports club management. Each customer is an `Organization`. A single Next.js 14 app (App Router) serves multiple portals via subdomain routing. The database is PostgreSQL accessed through Prisma ORM.

---

## Critical Rules

### 1. Never Trust Client-Provided `organizationId`

Every **authenticated** API route must derive the organization from the session — never from query params, request body, or headers.

```typescript
// CORRECT
const session = await getAuthSession();
const organizationId = session.user.organizationId;

// WRONG — security vulnerability
const { organizationId } = await request.json();
```

**Exception — public endpoints (`/api/public/`):** These serve users who may not be members of the target org (e.g., a parent registering at a new club). Use `resolvePublicRequest` from `src/lib/public-api.ts` to validate the client-provided `organizationId` against the Host header subdomain:

```typescript
import { resolvePublicRequest } from "@/lib/public-api";

const orgResult = await resolvePublicRequest(request, body.organizationId);
if (orgResult instanceof NextResponse) return orgResult;
const { organizationId } = orgResult;
```

### 2. Always Use `getScopedDb` for Tenant-Scoped Models

`getScopedDb(organizationId)` wraps Prisma with a Proxy that automatically injects `organizationId` into every read/write for models in the `TENANT_MODELS` list (`src/lib/db.ts`).

```typescript
import { getScopedDb } from "@/lib/db";

const scopedDb = getScopedDb(session.user.organizationId);

// organizationId injected automatically
const programs = await scopedDb.program.findMany();
const program = await scopedDb.program.create({ data: { name: "New" } });
await scopedDb.program.delete({ where: { id } });
```

### 3. Filter Relation-Scoped Models Manually

Some models don't have a direct `organizationId` — filter through their relation chain:

```typescript
// Payment → via Invoice
await db.payment.findMany({
  where: { invoice: { organizationId } },
});

// Enrollment → via Program
await db.enrollment.findMany({
  where: { program: { organizationId } },
});

// AthleteMembership → via instance → group
await db.athleteMembership.findMany({
  where: { instance: { group: { organizationId } } },
});

// Athlete list → via organizationAthletes junction
await db.athlete.findMany({
  where: { organizationAthletes: { some: { organizationId } } },
});
```

### 4. Add Defensive Org Checks Inside Transactions

`getScopedDb` extensions do not propagate into `$transaction` callbacks. Always verify ownership inside the callback before mutating.

```typescript
const result = await db.$transaction(async (tx) => {
  const record = await tx.program.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!record) throw new Error("Not found or access denied");
  return tx.program.update({ where: { id }, data });
});
```

### 5. Don't Org-Scope Medical Data

`AthleteMedicalInfo` is intentionally shared across organizations. Do not add `organizationId` filters when querying it. Medical records follow the athlete, not the org.

---

## Standard Patterns

### API Route Template

```typescript
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const scopedDb = getScopedDb(session.user.organizationId);
  const record = await scopedDb.program.create({
    data: { name: parsed.data.name },
  });

  return NextResponse.json(record);
}
```

### Date Fields

Use `parseDateOnly()` for date-only values (no time component). Using `new Date(dateString)` directly causes timezone drift bugs. See `docs/DATE-HANDLING.md`.

```typescript
import { parseDateOnly } from "@/lib/date-utils";

// CORRECT
const date = parseDateOnly(body.startDate); // returns a UTC midnight date

// WRONG — can shift date by timezone offset
const date = new Date(body.startDate);
```

### Phone Fields

Always use `PhoneInput` from `@/components/ui/phone-input`. Store in E.164 format. Validate with `isValidPhoneNumber()` from `react-phone-number-input` on both client and server.

```typescript
// Display
import { formatPhoneNumberIntl } from "react-phone-number-input";
formatPhoneNumberIntl(phone) || phone;

// Never use
<input type="tel" />
```

### Data Tables

Use TanStack React Table v8 (`@tanstack/react-table`). See `docs/data-table-migration.md` for the standard column/table setup used throughout the app.

---

## Where Things Live

| What                         | Where                                            |
| ---------------------------- | ------------------------------------------------ |
| All API routes               | `src/app/api/`                                   |
| Tenant isolation logic       | `src/lib/db.ts` → `getScopedDb`, `TENANT_MODELS` |
| Auth config + session        | `src/lib/auth.ts`                                |
| Subdomain routing middleware | `src/middleware.ts`                              |
| Email service                | `src/lib/email.ts`                               |
| SMS service                  | `src/lib/sms-service.ts`, `src/lib/twilio.ts`    |
| Payment processing           | `src/lib/adyen.ts`, `src/lib/adyen-platform.ts`  |
| Adyen provisioning scripts   | `scripts/provision-adyen.ts`                     |
| File storage                 | `src/lib/storage.ts`                             |
| Feature flags                | `src/lib/feature-toggles.ts`                     |
| Accounting integrations      | `src/lib/qbo.ts`, `src/lib/xero.ts`              |
| Prisma schema                | `prisma/schema.prisma`                           |
| Custom React hooks           | `src/hooks/`                                     |
| Shared UI components         | `src/components/`                                |
| Type definitions             | `src/types/`                                     |
| Public API org resolution    | `src/lib/public-api.ts`                          |
| Zustand stores               | `src/store/`                                     |

---

## Portal Routing

Each portal is a subdomain. The middleware (`src/middleware.ts`) parses the subdomain and rewrites the request to the correct internal path.

| Subdomain     | Internal path prefix | Audience                       |
| ------------- | -------------------- | ------------------------------ |
| `admin.`      | `/dashboard/`        | Org admins, staff              |
| `athletes.`   | `/athletes/`         | Parents, self-managed athletes |
| `coach.`      | `/coach/`            | Coaches                        |
| `pos.`        | `/pos/`              | Front desk                     |
| `superadmin.` | `/superadmin/`       | Uplifter staff only            |
| `[org-slug].` | `/sites/[slug]/`     | Public visitors                |
| `login.`      | `/(auth)/`           | All unauthenticated users      |

**Tenant site navigation rule:** Client-side `Link` hrefs and `router.push` calls inside `/sites/[slug]/` must use simple paths (`/checkout`, `/register`). Never include `/sites/{slug}/` — the middleware inserts that prefix automatically.

---

## Adding Things

### New API Route

1. Create the file under `src/app/api/your-path/route.ts`
2. Check auth with `getAuthSession()` — return 401 if missing
3. Validate input with Zod
4. Use `getScopedDb` for tenant-scoped models, or filter manually for relation-scoped ones
5. Inside `$transaction`, add a defensive org check before any mutation
6. Return `NextResponse.json()`

Full checklist: `src/app/api/README.md`

### New Database Model

1. Add the model to `prisma/schema.prisma`
2. Run `pnpm prisma migrate dev --name <descriptive-name>`
3. If the model has a direct `organizationId` column, add it to `TENANT_MODELS` in `src/lib/db.ts`
4. Add TypeScript types to `src/types/` if needed

### New Cron Job

1. Add the handler at `src/app/api/cron/your-job/route.ts`
2. Verify the `CRON_SECRET` header before processing
3. Register the schedule in `vercel.json` under `"crons"`

### New Notification Trigger Type

1. Add the value to the `NotificationTriggerType` enum in `prisma/schema.prisma`
2. Migrate
3. Add handling in the `process-notifications` cron logic
4. Update `NotificationDeduplication` logic if the trigger can fire repeatedly

---

## Multi-Organization Users

A single `User` can belong to multiple `Organization` records via `OrganizationMember`. The active org is stored in the session (`session.user.organizationId`). Users switch orgs via the org switcher — this updates the session, not the user record. When writing code that reads the current user's data, always scope to the active `organizationId`, not just the `userId`.

---

## External Services Quick Reference

| Service           | Env vars                                  | Dev equivalent             |
| ----------------- | ----------------------------------------- | -------------------------- |
| PostgreSQL        | `DATABASE_URL`                            | Docker (postgres:16)       |
| Email (SES)       | `AWS_SES_FROM_EMAIL`, `AWS_SES_REGION`    | MailHog (`localhost:8025`) |
| SMS (Twilio)      | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | `TWILIO_ENVIRONMENT=TEST`  |
| Payments (Adyen)  | `ADYEN_API_KEY`, `ADYEN_MERCHANT_ACCOUNT` | `ADYEN_ENVIRONMENT=TEST`   |
| File storage (S3) | `AWS_S3_BUCKET`, `AWS_S3_REGION`          | MinIO (`localhost:9000`)   |
| Redis             | Upstash `UPSTASH_REDIS_REST_URL`          | Docker Redis               |

Toggle between local and cloud storage with `USE_S3_STORAGE=false` (uses local filesystem) vs `USE_S3_STORAGE=true`.

### Adyen Local Setup (Provisioning Script)

Each developer gets their own isolated Adyen API credentials via:

```bash
pnpm dlx tsx scripts/provision-adyen.ts --env local --dev-tag <your-name>
```

The `--dev-tag` is required for local environments — use your first name or a short handle. The script creates 3 API credentials and 4 webhooks scoped to that tag (e.g., `"Uplifter Checkout - local-name"`). Re-running with the same tag rotates the existing keys instead of creating duplicates.

**Prerequisites:**

- `ADYEN_API_KEY` must already be set in the local `.env` (the shared team key from the `leapfrog_test_payments` credential). This key bootstraps the Management API calls that create the developer's own credentials.
- `WEBHOOK_TUNNEL_URL` should be set if using ngrok for local webhook testing.

**After running the script:**

1. Copy the output `.env` fragment into your `.env`, replacing the Adyen key lines
2. Keep single quotes as-is in the output — do NOT backslash-escape `$` signs (dotenv treats single-quoted values literally, so `\$` becomes a literal backslash + dollar, which corrupts the key and causes 401 errors)
3. Manually set these (not auto-provisioned):
   - `ADYEN_BALANCE_PLATFORM=UplifterLLC`
   - `ADYEN_PLATFORM_MERCHANT_ACCOUNT=KirraCapital_Leapfrog_TEST`
   - `ADYEN_LIABLE_BALANCE_ACCOUNT_ID=BA32957223227M5KTBSHJFVFL`

**Critical `.env` quoting rule:** Adyen API keys contain `$`, `;`, `^`, and other shell-sensitive characters. Always wrap them in single quotes in `.env` files. Never backslash-escape `$` inside single quotes — dotenv preserves backslashes literally, which makes the key invalid.

```bash
# CORRECT — single quotes, no escaping
ADYEN_API_KEY='AQE...PU8=-i1iXhz{^)R;;$A*.$]5'

# WRONG — backslash-escaped dollar signs corrupt the key
ADYEN_API_KEY='AQE...PU8=-i1iXhz{^)R;;\$A*.\$]5'
```

### Adyen MCP Server (AI Agents)

When an AI agent needs to troubleshoot or manage Adyen configuration (list credentials, test API keys, inspect webhooks, create payment sessions), it **must** have access to the `adyen-mcp-server` MCP. Without it, the agent cannot interact with the Adyen Management or Checkout APIs directly.

The MCP server reads `ADYEN_API_KEY` and `ADYEN_MERCHANT_ACCOUNT` from the environment. If these are missing or invalid (e.g., corrupted by `\$` escaping), all MCP calls will return 401.

Key MCP tools for Adyen troubleshooting:

| Tool                         | Use case                                        |
| ---------------------------- | ----------------------------------------------- |
| `list_merchant_accounts`     | Verify API key works, find merchant account IDs |
| `create_payment_session`     | Test end-to-end checkout flow                   |
| `get_payment_methods`        | Confirm merchant account is configured          |
| `list_all_company_webhooks`  | Audit webhook configuration                     |
| `list_all_merchant_webhooks` | Check merchant-level webhooks                   |
| `get_account_holder`         | Inspect balance platform account holders        |

---

## What Not To Do

- **Don't add `organizationId` to `AthleteMedicalInfo` queries** — intentionally shared across orgs
- **Don't use raw `db` client for tenant-scoped writes** — always use `getScopedDb` or include the org filter explicitly
- **Don't use `new Date(dateString)` for date-only fields** — use `parseDateOnly()`
- **Don't use `<input type="tel">`** — use `PhoneInput` component
- **Don't trust `organizationId` from request bodies or query params** — use `session.user.organizationId` for authenticated routes, or `resolvePublicRequest` for `/api/public/` routes
- **Don't add `/sites/{slug}/` to client-side navigation hrefs** inside tenant site pages
- **Don't mutate inside a transaction without first verifying org ownership** — `getScopedDb` doesn't propagate into `$transaction` callbacks
- **Don't create new abstractions for one-off operations** — inline the logic
- **Don't add error handling for impossible states** — only validate at system boundaries
- **Don't backslash-escape `$` in single-quoted `.env` values** — dotenv preserves `\` literally, corrupting Adyen API keys and causing 401 errors

---

## Commits

Follow Conventional Commits. Format: `type: US-### lowercase imperative description`

Every commit must include a ticket number (`US-` followed by digits) immediately after the colon.

**Types:** `feat`, `fix`, `refactor`, `chore`, `style`, `docs`, `test`, `perf`

- Ticket number required — `feat: US-42 add billing page` not `feat: add billing page`
- No scope — `feat: US-42 add billing page` not `feat(billing): US-42 add page`
- Lowercase after the ticket number, imperative mood, single line, concise

```
feat: US-42 add organization deactivation for superadmins
fix: US-118 resolve timezone shift on date-only fields
refactor: US-95 migrate ledger tables to reusable DataTable components
chore: US-7 remove defunct quick link from superadmin sidebar
```

## Pull Requests

When asked to create a PR, use `gh pr create`. Use this description structure:

```
## What does this PR do?
<one or two sentences>

## Requires DB Migration?
- [ ] Yes
- [ ] No

## Type of change
<feat / fix / refactor / chore / docs>

## Testing
<numbered steps>

## Screenshots / recordings
<if UI changed>
```

## Package Manager

Always `pnpm`. Never `npm` or `npx`.

- `pnpm add <pkg>` not `npm install <pkg>`
- `pnpm dlx <cmd>` not `npx <cmd>`

## Commits

Follow Conventional Commits. Format: `type: US-### lowercase imperative description`

Every commit must include a ticket number (`US-` followed by digits) immediately after the colon.

| Type       | When to use                                  |
| ---------- | -------------------------------------------- |
| `feat`     | New feature or capability                    |
| `fix`      | Bug fix                                      |
| `refactor` | Code restructuring with no behavior change   |
| `chore`    | Maintenance, deps, scripts, config           |
| `style`    | Visual/UI-only changes (not code formatting) |
| `docs`     | Documentation only                           |
| `test`     | Adding or updating tests                     |
| `perf`     | Performance improvement                      |

- Ticket number required — `feat: US-42 add billing page` not `feat: add billing page`
- No scope — `feat: US-42 add billing page` not `feat(billing): US-42 add page`
- Lowercase after the ticket number, no capital first word
- Imperative mood — "add", "fix", "remove" not "added", "fixes", "removed"
- Single line unless explicitly asked for a body
- Concise — short phrase, not a full sentence
- No "Co-Authored-By" trailers — never add Claude attribution to commits

**Examples:**

```
feat: US-42 add organization deactivation/reactivation for superadmins
fix: US-118 resolve all non-Adyen TypeScript errors across the project
refactor: US-95 migrate ledger tables to reusable DataTable components
chore: US-7 remove defunct User Signup quick link from superadmin sidebar
style: US-203 move Directory to top of Athletes section in admin sidebar
```
