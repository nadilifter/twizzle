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

### 6. Always Route Outbound SMS Through `sendSingleSms` (TCPA)

Never call `twilio.messages.create()` directly. Route every outbound SMS through `sendSingleSms` in `src/lib/sms-service.ts` — it enforces the `User.smsOptOut` gate, applies usage limits, resolves the pool number, and writes the `Message` audit row. Direct Twilio calls bypass all of that and create a compliance risk.

```typescript
import { sendSingleSms } from "@/lib/sms-service";

await sendSingleSms({
  organizationId,
  to: user.phone,
  userId: user.id,
  body: "Your class is tomorrow at 9am",
  classification: "REMINDER",
});
```

Consent writes go through the helpers in `src/lib/sms-consent.ts`. Use `buildSmsConsentGrant(source, ip)` when a user opts in (sets `smsConsentAt`, `smsConsentSource`, `smsConsentIp`, `smsConsentVersion`, and clears any prior opt-out) and `buildSmsConsentRevoke(source)` for UI opt-out or inbound `STOP` (clears the consent fields, sets `smsOptOut = true`, records `smsConsentRevokeSource`). Don't hand-roll these updates — bump `SMS_CONSENT_VERSION` instead when the disclosure copy changes materially so existing users are forced to re-affirm.

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

### Image URL Validation

Use the shared `imageUrlSchema` from `src/lib/schemas.ts` for any `imageUrl` field in Zod schemas. It accepts both absolute URLs (`https://cdn.example.com/...`) and relative paths (`/uploads/...`) so local dev works without S3/MinIO.

```typescript
import { imageUrlSchema } from "@/lib/schemas";

const schema = z.object({
  imageUrl: imageUrlSchema.optional().nullable(),
});
```

Don't use `z.string().url()` for image URLs — it rejects the relative paths returned by the local filesystem upload fallback.

### Image Uploads

Use the `ImageUpload` component from `src/components/ui/image-upload.tsx`. It handles file selection, upload to `/api/upload`, and returns the URL via `onChange`. Supported types: `logo`, `favicon`, `hero`, `program`, `product`, `team`, `category`.

```tsx
<ImageUpload
  label="Program Image"
  value={formData.imageUrl}
  onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
  type="program"
/>
```

`ImageUpload` works safely inside `Sheet` and `Dialog` overlays — the base components prevent focus-outside dismissal so native file pickers don't close the overlay. If you build a custom file input inside a Radix overlay, this is already handled at the `SheetContent`/`DialogContent` level via `onFocusOutside`.

### Data Tables

Use TanStack React Table v8 (`@tanstack/react-table`). See `docs/data-table-migration.md` for the standard column/table setup used throughout the app.

### Dashboard Page Headers

Every list/section page in the admin portal uses `DashboardPageHeader` (`src/components/dashboard-page-header.tsx`) — do **not** hand-roll a `<div className="flex items-center justify-between"><h1>...</h1><Button/>...` header. The shared component handles mobile responsiveness (actions drop below the title on narrow screens and the primary button grows to fill the width).

```tsx
import { DashboardPageHeader } from "@/components/dashboard-page-header";

<DashboardPageHeader
  title="Programs"
  description="Manage your registration programs and enrollment options."
  actions={
    <Button asChild>
      <Link href="/dashboard/registrations/programs/new">Add Program</Link>
    </Button>
  }
/>;
```

Pass multiple action buttons as a fragment — they render inside a `flex-wrap` container and each grows to fill on mobile. Use `variant="small"` for sub-pages (edit/create forms) that want `text-2xl` instead of the default `text-3xl` title.

If the page has a back button (create/edit forms), wrap the back button + `DashboardPageHeader` in a flex row: `<div className="flex items-start gap-4"><BackButton /><div className="min-w-0 flex-1"><DashboardPageHeader ... /></div></div>`.

### Chat Split-Pane Layout

Chat pages across the three portals use the `ChatPanels` family (`src/components/chat/chat-panels.tsx`) for responsive sidebar + message-view layouts. Compose `ChatPanelsSidebar` and `ChatPanelsMain` as children of `ChatPanels`, and put a `ChatPanelsBackButton` inside the `ChatHeader` on the main pane. Desktop renders side-by-side; mobile shows one pane at a time driven by the `hasSelection` prop.

### Responsive Toolbars

For search + filter/action button rows above a table, stack on mobile and switch to the inline layout at `sm:`:

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  <div className="relative w-full sm:max-w-sm sm:flex-1">
    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input className="pl-8" placeholder="Search..." />
  </div>
  <div className="flex flex-wrap items-center gap-2">
    {/* action buttons; use `flex-1 sm:flex-none` on any button that should grow on mobile */}
  </div>
</div>
```

Wrap data tables in `<div className="overflow-x-auto rounded-md border">` so they scroll horizontally on narrow screens instead of squishing columns.

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
| Shared Zod schemas           | `src/lib/schemas.ts`                             |
| Image upload component       | `src/components/ui/image-upload.tsx`             |
| Dashboard page header        | `src/components/dashboard-page-header.tsx`       |
| Chat split-pane layout       | `src/components/chat/chat-panels.tsx`            |
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
5. Update the ERD docs — add the model to the relevant section in `docs/ERD.md` (domain-grouped Mermaid ERDs with field-level annotations) and, if the new model belongs to a new top-level domain, the overview in `docs/data-structure.md`

### Understanding the Data Model

Before writing schema-heavy code, read:

- `docs/ERD.md` — domain-grouped ERD covering every model with field-level meaning (what each column represents, not just its type)
- `docs/data-structure.md` — high-level entity map, design patterns (polymorphic billing, cross-org athletes, etc.), cross-domain flows, enum reference
- `prisma/schema.prisma` — source of truth (but ~5,200 lines; the docs above are faster to scan)

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

### Adyen Local Setup

API credentials are **shared** — get the three API keys (`ADYEN_API_KEY`, `ADYEN_PLATFORM_API_KEY`, `ADYEN_LEM_API_KEY`) from a teammate. Do not create per-developer credentials.

Webhooks are **per-developer**. Use the provisioning script to create them:

```bash
pnpm dlx tsx scripts/provision-adyen.ts --dev-tag <your-name>
```

This creates 4 webhook subscriptions pointing to your `WEBHOOK_TUNNEL_URL` (ngrok) and outputs the HMAC keys. The standard payment webhook is scoped to `KirraCapital_Leapfrog_LOCAL_TEST` so it only fires for local transactions. If the script fails, create webhooks manually in the [Adyen Test Customer Area](https://ca-test.adyen.com) following `docs/adyen-platform/manual-credential-setup.md`.

**Critical `.env` quoting rule:** Adyen API keys contain `$`, `;`, `^`, and other shell-sensitive characters. Always wrap them in single quotes **and** escape `$` as `\$`. Next.js uses `@next/env` which chains `dotenv` → `dotenv-expand`. The `dotenv` parser preserves `\$` literally inside single quotes, then `dotenv-expand` recognizes `\$` as an escaped dollar and outputs `$`. Without the backslash, `dotenv-expand` treats `$VAR` as a variable reference and silently expands it to empty.

```bash
# CORRECT — single quotes with \$ escaping
ADYEN_API_KEY='AQE...PU8=-i1iXhz{^)R;;\$A*.\$]5'

# WRONG — unescaped $ gets silently expanded to empty by dotenv-expand
ADYEN_API_KEY='AQE...PU8=-i1iXhz{^)R;;$A*.$]5'
```

### Adyen MCP Server (AI Agents)

When an AI agent needs to troubleshoot or manage Adyen configuration (list credentials, test API keys, inspect webhooks, create payment sessions), it **must** have access to the `adyen-mcp-server` MCP. Without it, the agent cannot interact with the Adyen Management or Checkout APIs directly.

The MCP server reads `ADYEN_API_KEY` and `ADYEN_MERCHANT_ACCOUNT` from the environment. If these are missing or invalid (e.g., corrupted by unescaped `$` in `.env` values), all MCP calls will return 401.

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
- **Don't call `twilio.messages.create()` directly** — route outbound SMS through `sendSingleSms` so the opt-out gate, usage limits, and `Message` audit trail are applied
- **Don't hand-write SMS consent fields** — use `buildSmsConsentGrant` / `buildSmsConsentRevoke` from `src/lib/sms-consent.ts` so `smsConsentAt`, `smsConsentSource`, `smsConsentVersion`, `smsOptOut`, and `smsConsentRevokeSource` stay in sync
- **Don't trust `organizationId` from request bodies or query params** — use `session.user.organizationId` for authenticated routes, or `resolvePublicRequest` for `/api/public/` routes
- **Don't add `/sites/{slug}/` to client-side navigation hrefs** inside tenant site pages
- **Don't mutate inside a transaction without first verifying org ownership** — `getScopedDb` doesn't propagate into `$transaction` callbacks
- **Don't use `z.string().url()` for `imageUrl` fields** — use `imageUrlSchema` from `src/lib/schemas.ts` which also accepts relative paths for local dev
- **Don't create new abstractions for one-off operations** — inline the logic
- **Don't add error handling for impossible states** — only validate at system boundaries
- **Don't leave `$` unescaped in `.env` values** — use `\$` inside single quotes so `dotenv-expand` (used by `@next/env`) preserves the literal character; unescaped `$` is silently expanded to empty, corrupting API keys
- **Don't use `.env.local` for Adyen keys** — Next.js loads `.env.local` with higher priority than `.env`, so changes to `.env` are silently ignored if both files set the same variable

---

## Commits

Follow Conventional Commits. Format: `type: PREFIX-### lowercase imperative description`

Every commit must include a ticket number immediately after the colon. Valid prefixes: `US-`, `USC-`, `DEV-`, `LF-` (each followed by digits).

**Types:** `feat`, `fix`, `refactor`, `chore`, `style`, `docs`, `test`, `perf`

- Ticket number required — `feat: US-42 add billing page` not `feat: add billing page`
- Valid prefixes: `US-`, `USC-`, `DEV-`, `LF-`
- No scope — `feat: US-42 add billing page` not `feat(billing): US-42 add page`
- Lowercase after the ticket number, imperative mood, single line, concise

```
feat: US-42 add organization deactivation for superadmins
fix: USC-118 resolve timezone shift on date-only fields
refactor: DEV-95 migrate ledger tables to reusable DataTable components
chore: LF-7 remove defunct quick link from superadmin sidebar
```

## Before Pushing

Before running `git push`, review all files changed on the current branch for:

- **Duplicate code** — logic that appears in multiple places and should be a shared helper
- **Dead code** — unused variables, functions, or imports
- **Extraction opportunities** — inline logic complex enough to warrant its own named function

Run the `/simplify` skill on the changed files, fix any issues found, then push.

## Pull Requests

**Title format:** `type: USC-### description` — ticket number goes in the subject, not as the type.

```
feat: USC-229 add local free trial billing test flow
fix: USC-118 resolve timezone shift on date-only fields
```

The CI `pr-title` check enforces this with `amannn/action-semantic-pull-request`. Valid types: `feat`, `fix`, `refactor`, `chore`, `style`, `docs`, `test`, `perf`. Ticket prefixes: `US-`, `USC-`, `PD-`.

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

Follow Conventional Commits. Format: `type: PREFIX-### lowercase imperative description`

Every commit must include a ticket number immediately after the colon. Valid prefixes: `US-`, `USC-`, `DEV-`, `LF-` (each followed by digits).

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
- Valid prefixes: `US-`, `USC-`, `DEV-`, `LF-`
- No scope — `feat: US-42 add billing page` not `feat(billing): US-42 add page`
- Lowercase after the ticket number, no capital first word
- Imperative mood — "add", "fix", "remove" not "added", "fixes", "removed"
- Single line unless explicitly asked for a body
- Concise — short phrase, not a full sentence
- No "Co-Authored-By" trailers — never add Claude attribution to commits

**Examples:**

```
feat: US-42 add organization deactivation/reactivation for superadmins
fix: USC-118 resolve all non-Adyen TypeScript errors across the project
refactor: DEV-95 migrate ledger tables to reusable DataTable components
chore: LF-7 remove defunct User Signup quick link from superadmin sidebar
style: US-203 move Directory to top of Athletes section in admin sidebar
```
