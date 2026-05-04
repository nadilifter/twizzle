# Uplifter Feature Catalog

> **Status:** Skeleton — seeded 2026-05-01. Most sections are stubs marked `TODO`. Fill in feature-by-feature; do not bulk-edit.

This document is the **exhaustive, code-anchored** inventory of every feature, sub-feature, and behavior in the platform. Where another doc owns the deep dive (e.g. `BUSINESS-RULES.md` for billing lifecycle, `ERD.md` for schema), this file links to it instead of duplicating.

---

## How this doc is organized

- **Part 0 — Foundations:** infrastructure-level features that every tenant gets unconditionally (auth, tenant isolation, portal routing).
- **Part 1 — Core domain (always-on):** product features available on every plan (athletes, programs, registration, base financial, base communications, waivers, facilities, public site).
- **Part 2 — Plan-gated features:** the 16 keys defined in [src/lib/feature-toggles.ts](../src/lib/feature-toggles.ts). One section per key, in source-file order.
- **Part 3 — Platform admin (superadmin):** features only Uplifter staff use (plans, dunning, KYC, system announcements).
- **Part 4 — Cross-cutting concerns:** registries that span multiple features (cron jobs, webhooks, external integrations, security).

Within each Part, top-level sections are features. Each feature has sub-features as a checklist so progress is visible.

---

## Standard feature template

Every feature section follows this template. **Do not deviate** — consistency is what makes this doc skimmable.

```markdown
### {Feature name}

**Status:** Live | Demo | Hidden | Planned | Deprecated | Unknown
**Plan gate:** `featureKey` (link to feature-toggles.ts) | Always on | Superadmin only
**Portals:** admin, athletes, coach, pos, events, sites, superadmin, login, startup, feedback
**Primary models:** `Model1`, `Model2`, …
**Owner / latest major work:** TODO (PR # or commit)

#### What it does

One paragraph, plain English. What problem does it solve, for whom?

#### Sub-features

- [ ] Sub-feature 1 — one-line description
- [ ] Sub-feature 2 — one-line description

#### User flows

Step-by-step for the golden path(s). Cite portal + page + action.

#### Permissions & roles

Who can do what. Cite role enum values and any custom permission checks.

#### Data model

Models touched, key relations, important enums. Link to ERD section.

#### API routes

Bullet list of `src/app/api/...` directories/files involved.

#### Background jobs

Relevant crons from [BUSINESS-RULES.md § Cron Jobs](BUSINESS-RULES.md#cron-jobs).

#### External integrations

Adyen / Twilio / SES / S3 / QBO / Xero / etc. Cite key files.

#### Webhooks

Inbound events received. Cite handler files.

#### Notifications & emails

Automated messages this feature sends. Cite templates + triggers.

#### Configuration

Env vars, per-org settings, feature toggles, plan-level config.

#### Lifecycle / state machines

Status transitions, with diagram if non-trivial.

#### Business rules & edge cases

Non-obvious rules. Cross-link to BUSINESS-RULES.md where relevant.

#### Known limitations / gaps

TODOs, hidden states, planned-but-not-shipped sub-features.

#### Code references

- `src/path/file.ts:LL` — what lives here
- `src/path/file.ts:LL` — what lives here
```

### Status legend

| Status         | Meaning                                                |
| -------------- | ------------------------------------------------------ |
| **Live**       | Shipped, in production, customers using it             |
| **Demo**       | Shipped but only shown internally / to design partners |
| **Hidden**     | Code exists but no UI entrypoint                       |
| **Planned**    | Stub or partial implementation, not user-facing        |
| **Deprecated** | Still in code, scheduled for removal                   |
| **Unknown**    | Not yet audited — needs verification                   |

---

## How to maintain this doc

- **When you ship a new feature:** add a section using the template, with `Status: Live` and a code-reference link to your PR.
- **When you change a feature's behavior:** update the affected sub-section. Do not rewrite the whole section.
- **Code references must include `file:line`** so cmd-click navigates correctly. If a referenced symbol moves, update the line number.
- **When in doubt about a fact, mark it `TODO: verify`** rather than guessing — drift is worse than gaps.
- The pre-commit hook does **not** enforce updates to this doc. Reviewers should call it out.

---

# Part 0 — Foundations

> Infrastructure-level features. Always on, not user-toggleable.

### 0.1 Multi-portal subdomain routing

**Status:** Live · **Plan gate:** Always on · **Portals:** all
**Primary models:** `WebsiteConfig`, `ReservedDomain`
**Owner / latest major work:** TODO

#### What it does

A single Next.js deployment serves every portal. The middleware inspects the request's Host header, identifies the subdomain, and internally rewrites the URL to the appropriate `src/app/` directory segment. New customers each get a subdomain that becomes their public marketing site. Reserved subdomains (e.g. `admin`, `login`) are protected from being claimed.

#### Sub-features

- [x] Reserved-portal subdomain → app directory mapping
- [x] Tenant marketing-site rewrite (`gym.uplifter.app` → `/sites/gym/`)
- [x] Per-environment base domain (production, staging, development, local)
- [x] Reserved/blocked subdomain enforcement via DB-backed `ReservedDomain` table
- [x] Subdomain availability check API (live during signup)
- [x] Subdomain format validation (lowercase alphanumeric + hyphens)
- [x] Profanity filter on subdomain (and org name) via `bad-words` package, hyphen-aware
- [x] Local-dev wildcard host support (`*.uplifter.localhost:3000`)
- [x] Auth gating per portal (some portals require session, some don't)
- [x] Cross-subdomain session bridging (OAuth-on-localhost workaround)
- [ ] **Planned `competitions.` and `results.` portals** — currently fall through to wildcard tenant-site rewrite (i.e. they treat themselves as org subdomains, not portal subdomains). Will need explicit handlers when implemented.

#### Subdomain map ([src/middleware.ts:30-476](../src/middleware.ts#L30-L476))

| Subdomain                     | Rewrite target    | Auth required                                            | Lines                                     |
| ----------------------------- | ----------------- | -------------------------------------------------------- | ----------------------------------------- |
| `login.`                      | `/(auth)/*`       | No (issuer)                                              | [167-193](../src/middleware.ts#L167-L193) |
| `admin.`                      | `/dashboard/*`    | Yes — redirects to `login.{baseDomain}/login` if missing | [196-267](../src/middleware.ts#L196-L267) |
| `superadmin.`                 | `/superadmin/*`   | Yes + `isSuperAdmin` flag                                | [270-302](../src/middleware.ts#L270-L302) |
| `coach.`                      | `/coach/*`        | Yes                                                      | [305-314](../src/middleware.ts#L305-L314) |
| `athletes.`                   | `/athletes/*`     | Yes                                                      | [317-346](../src/middleware.ts#L317-L346) |
| `pos.`                        | `/pos/*`          | Yes                                                      | [349-390](../src/middleware.ts#L349-L390) |
| `feedback.`                   | `/feedback/*`     | **No** (public)                                          | [393-402](../src/middleware.ts#L393-L402) |
| `events.`                     | `/events/*`       | Yes                                                      | [405-414](../src/middleware.ts#L405-L414) |
| `startup.`                    | `/org-signup/*`   | **No** (public)                                          | [419-428](../src/middleware.ts#L419-L428) |
| `[org-slug].` (anything else) | `/sites/{slug}/*` | Mixed (some pages require session)                       | [431-443](../src/middleware.ts#L431-L443) |

Tenant-site rewrite line: [src/middleware.ts:441](../src/middleware.ts#L441) — `url.pathname = /sites/${currentHost}${path}`.

#### Per-environment domains ([src/lib/env-domains.ts:27-69](../src/lib/env-domains.ts#L27-L69))

| Env           | Base domain                  | Cookie domain                 |
| ------------- | ---------------------------- | ----------------------------- |
| `production`  | `uplifter.app`               | `.uplifter.app`               |
| `staging`     | `upliftergymnastics.com`     | `.upliftergymnastics.com`     |
| `development` | `upliftergymnastics-dev.com` | `.upliftergymnastics-dev.com` |
| `local`       | `uplifter.localhost:3000`    | `.uplifter.localhost`         |

`getCurrentEnvironment()` ([env-domains.ts:75-85](../src/lib/env-domains.ts#L75-L85)) reads `APP_ENVIRONMENT`, defaults to `local`, falls back to `production` if `NODE_ENV === "production"`.

#### Reserved subdomains

- DB model: `ReservedDomain` ([prisma/schema.prisma:3344-3350](../prisma/schema.prisma#L3344-L3350)) — fields: `pattern` (unique), `type` (`EXACT` | `PREFIX`), `reason`, `createdBy`, timestamps.
- Helper: [src/lib/reserved-domains.ts](../src/lib/reserved-domains.ts) — `isSubdomainReserved(subdomain)` does pattern matching.
- Superadmin UI: [src/app/superadmin/domains/reserved/page.tsx](../src/app/superadmin/domains/reserved/page.tsx).
- **Note:** `parseSlugFromHost` in `public-api.ts` _also_ hardcodes a SYSTEM_SUBDOMAINS set (`admin, login, superadmin, coach, athletes, pos, feedback, events, startup, www, main`) — these short-circuit before the DB check. The DB-backed list adds extensibility on top.

#### Profanity filter ([src/lib/profanity.ts](../src/lib/profanity.ts))

- Uses the `bad-words` npm package (version 4.x per `package.json`).
- `containsProfanity(text)` checks the input as-is, then again with hyphens replaced by spaces — so `bad-word-club` is screened as `bad word club`. Used on both organization name and subdomain at signup.

#### Subdomain availability check

- **Endpoint:** `GET /api/organization/website/check-subdomain` ([route](../src/app/api/organization/website/check-subdomain/route.ts))
- Validation regex: `/^[a-z0-9-]+$/` ([line 27](../src/app/api/organization/website/check-subdomain/route.ts#L27))
- Uniqueness: DB constraint on `WebsiteConfig.subdomain` ([prisma/schema.prisma:2854](../prisma/schema.prisma#L2854))
- Length limits: TODO — not enforced explicitly in route; relies on Prisma column constraint.
- Used by signup wizard at `startup.uplifter.app`.

#### User flows

**Visitor lands on `gym.uplifter.app/checkout`:**

1. Middleware parses Host header → subdomain `gym`.
2. `gym` not in reserved-portal list → falls to wildcard branch ([middleware.ts:431](../src/middleware.ts#L431)).
3. Auth check ([432-439](../src/middleware.ts#L432-L439)) — some site pages are gated.
4. Internal rewrite to `/sites/gym/checkout` ([line 441](../src/middleware.ts#L441)).
5. `src/app/sites/[slug]/checkout/page.tsx` renders, reading `slug = "gym"`.

**Authenticated admin visits `admin.uplifter.app`:**

1. Middleware parses → subdomain `admin`.
2. Session cookie verified ([209-217](../src/middleware.ts#L209-L217)) — if absent, redirect to `https://login.{baseDomain}/login?callbackUrl=...`.
3. Internal rewrite to `/dashboard`.

#### Permissions & roles

Portal-level enforcement only (admin requires any role; superadmin requires `isSuperAdmin`). Page-level permissions live downstream.

#### Data model

- `WebsiteConfig.subdomain` (unique) — the source of truth for tenant subdomains.
- `Organization.slug` — historically also used; check for drift between the two.
- `ReservedDomain` — global blocklist.

#### API routes

- `GET /api/organization/website/check-subdomain` — availability check.
- `POST /api/auth/oauth-bridge` — local-dev OAuth bridge ([src/app/api/auth/oauth-bridge/route.ts](../src/app/api/auth/oauth-bridge/route.ts))
- `GET /api/auth/session-bridge` — sets cookie on correct subdomain ([src/app/api/auth/session-bridge/route.ts](../src/app/api/auth/session-bridge/route.ts))
- `POST /api/auth/credentials-bridge` — local-dev password-login bridge ([src/app/api/auth/credentials-bridge/route.ts](../src/app/api/auth/credentials-bridge/route.ts))

#### Background jobs

None.

#### External integrations

None directly. Custom domains (gated) interact at the DNS/TLS layer outside this feature; see § 2.5.

#### Webhooks

None.

#### Notifications & emails

None.

#### Configuration

- `APP_ENVIRONMENT` env var — selects domain config.
- `/etc/hosts` entries required for local dev (see [README.md:301-313](../README.md#L301-L313)).

#### Lifecycle / state machines

N/A — stateless routing.

#### Business rules & edge cases

- **`competitions.` and `results.` are unimplemented portals.** Today, requests to those subdomains are treated as wildcard tenant-site lookups and rewritten to `/sites/competitions` / `/sites/results`. Unless an org has actually claimed those subdomains, the lookup will fail downstream. Adding portal handlers will require updating reserved-list AND middleware order.
- **Tenant-site links must use simple paths.** Inside `/sites/[slug]/` pages, `<Link href="/checkout">` is correct; `<Link href="/sites/gym/checkout">` will double-prefix.
- **`feedback.` and `startup.` are intentionally public.** Auth check is skipped.
- **`www.` is treated as system, not tenant.** `parseSlugFromHost` rejects it ([public-api.ts:6-18](../src/lib/public-api.ts#L6-L18)).
- **Cookie-domain split.** Cloud envs share `.uplifter.app` so cookies cross subdomains; local dev uses `.uplifter.localhost`. The session-bridge endpoints exist because Google OAuth doesn't allow `*.localhost` redirect URIs — see § 0.3.

#### Known limitations / gaps

- `competitions.` / `results.` subdomains silently misroute as tenant lookups instead of returning a clear "not yet implemented" response.
- Subdomain length min/max not validated explicitly in the check route — relies on Prisma column.
- DB-backed `ReservedDomain` is checked at signup but **not** by `parseSlugFromHost` at request resolution time (which uses a hardcoded SYSTEM_SUBDOMAINS set instead). Adding a DB pattern will not retroactively block already-claimed subdomains.

#### Code references

- [src/middleware.ts:30-476](../src/middleware.ts#L30-L476) — full routing logic
- [src/middleware.ts:441](../src/middleware.ts#L441) — tenant-site rewrite line
- [src/lib/env-domains.ts:27-85](../src/lib/env-domains.ts#L27-L85) — env config + `getCurrentEnvironment`
- [src/lib/public-api.ts:6-18](../src/lib/public-api.ts#L6-L18) — SYSTEM_SUBDOMAINS hardcoded list
- [src/lib/reserved-domains.ts](../src/lib/reserved-domains.ts) — DB-backed reserved check
- [src/app/api/organization/website/check-subdomain/route.ts:27-55](../src/app/api/organization/website/check-subdomain/route.ts#L27-L55) — availability check
- [src/lib/profanity.ts](../src/lib/profanity.ts) — `bad-words`-backed profanity check
- [prisma/schema.prisma:3344-3350](../prisma/schema.prisma#L3344-L3350) — `ReservedDomain` model
- [prisma/schema.prisma:2854](../prisma/schema.prisma#L2854) — `WebsiteConfig.subdomain` unique constraint

### 0.2 Tenant isolation (`getScopedDb`)

**Status:** Live · **Plan gate:** Always on · **Portals:** all (server-side enforcement)
**Primary models:** all 55 in `TENANT_MODELS`
**Owner / latest major work:** TODO

#### What it does

Every API route that handles a tenant-scoped model **must** use `getScopedDb(organizationId)` instead of the raw `db` import. The returned client is a Prisma extension that auto-injects an `organizationId` filter on reads and an `organizationId` value on writes, and verifies ownership before mutations. This is the primary security boundary preventing cross-tenant data leaks.

#### Sub-features

- [x] `TENANT_MODELS` registry — 55 models auto-scoped
- [x] Auto-injection on read (`findMany`, `findFirst`, `count`)
- [x] Auto-injection on create (`create`, `createMany`)
- [x] `findUnique` → `findFirst` rewrite (prevents direct-ID bypass)
- [x] Pre-mutation ownership verification (`update`, `delete`)
- [x] `updateMany` / `deleteMany` org filter injection
- [x] Upsert ownership check (existing record must belong to caller's org)
- [x] `TenantIsolationError` thrown on mismatch
- [x] Allowlist for legitimate raw-`db` callers (~195 active routes)
- [x] `pnpm lint:tenant` static check
- [x] Husky pre-commit enforcement (with `SKIP_TENANT_CHECK=1` bypass)
- [x] Public-API exception (resolves org from Host header instead of session)
- [x] Intentional carve-outs (medical info, platform-level models, SMS pool)
- [ ] **In-`$transaction` propagation** — `getScopedDb` does NOT propagate inside `$transaction`. Routes must add manual org checks.
- [ ] **CI enforcement** — `lint:tenant` is pre-commit only; not in `.github/workflows/ci.yml`. A force-push or `--no-verify` commit can bypass.

#### Intercepted operations ([src/lib/db.ts:268-376](../src/lib/db.ts#L268-L376))

| Operation    | Behavior                                                        | Lines                                 |
| ------------ | --------------------------------------------------------------- | ------------------------------------- |
| `findMany`   | Inject `organizationId` into `where`                            | [299-301](../src/lib/db.ts#L299-L301) |
| `findFirst`  | Inject `organizationId` into `where`                            | [303-305](../src/lib/db.ts#L303-L305) |
| `findUnique` | **Rewritten to `findFirst`** with org filter                    | [307-318](../src/lib/db.ts#L307-L318) |
| `count`      | Inject `organizationId` into `where`                            | [320-322](../src/lib/db.ts#L320-L322) |
| `create`     | Inject `organizationId` into `data`                             | [324-328](../src/lib/db.ts#L324-L328) |
| `createMany` | Inject into each row                                            | [330-337](../src/lib/db.ts#L330-L337) |
| `update`     | Verify ownership, then update                                   | [339-341](../src/lib/db.ts#L339-L341) |
| `updateMany` | Inject into `where`                                             | [343-345](../src/lib/db.ts#L343-L345) |
| `delete`     | Verify ownership, then delete                                   | [347-349](../src/lib/db.ts#L347-L349) |
| `deleteMany` | Inject into `where`                                             | [351-353](../src/lib/db.ts#L351-L353) |
| `upsert`     | Verify any existing record matches org; inject on create branch | [355-371](../src/lib/db.ts#L355-L371) |

**Not intercepted:** `aggregate`, `groupBy`, `$queryRaw`, `$executeRaw`, and operations within `$transaction` blocks. Callers must scope these manually.

#### `TENANT_MODELS` ([src/lib/db.ts:174-230](../src/lib/db.ts#L174-L230))

55 models. Verbatim list (alphabetized for readability — source order preserved in code):

`Achievement`, `Announcement`, `Category`, `Certification`, `Competition`, `CompetitionTeam`, `Conversation`, `CustomInfoConfig`, `CustomInfoQuestion`, `CustomInfoResponse`, `CustomMedicalQuestion`, `Discount`, `EmailCampaign`, `EmailMessage`, `EmailUsage`, `Equipment`, `EvaluationTemplate`, `Event`, `Facility`, `GLCode`, `Invoice`, `LedgerEntry`, `LessonPlan`, `Level`, `Media`, `MedicalFormConfig`, `MembershipGroup`, `Message`, `NotificationLog`, `NotificationRule`, `Order`, `OrganizationAthlete`, `OrganizationCategoryPreference`, `OrganizationHoliday`, `OrganizationInvitation`, `OrganizationMember`, `OrganizationSport`, `Pass`, `Payout`, `Product`, `Program`, `ProgramInstance`, `RecurringCharge`, `RegistrationFile`, `RegistrationQueueConfig`, `ScheduleTemplate`, `Season`, `Shift`, `Skill`, `SmsCampaign`, `SmsUsage`, `TeamMemberHighlight`, `Transaction`, `Waiver`, `WebsiteConfig`.

#### Intentionally excluded ([src/lib/db.ts:166-170](../src/lib/db.ts#L166-L170))

| Model                         | Reason                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| `OrganizationSubscription`    | Cross-org platform billing                                       |
| `OrganizationFeatureOverride` | Superadmin-managed                                               |
| `OrganizationPaymentMethod`   | System billing operations                                        |
| `AdyenPlatformAccount`        | Platform-level Adyen onboarding                                  |
| `OrganizationStatusLog`       | System audit trail                                               |
| `SubscriptionInvoice`         | Cross-org platform billing                                       |
| `SubscriptionPaymentAttempt`  | Cross-org platform billing                                       |
| `SmsNumberAssignment`         | Pool requires cross-org visibility to prevent routing collisions |

`AthleteMedicalInfo` is also excluded — but for a different reason (deliberately shared across orgs for athlete safety, not platform-level). See § 1.1.

#### `TenantIsolationError` ([src/lib/db.ts:242-246](../src/lib/db.ts#L242-L246))

Thrown at:

- [L290-292](../src/lib/db.ts#L290-L292) — update/delete ownership check fails
- [L365-367](../src/lib/db.ts#L365-L367) — upsert existing-record mismatch

Default message: `"Access denied: Resource does not belong to your organization"`. **HTTP status mapping:** not explicit in `db.ts` — depends on each route's catch handler (TODO: audit; some routes may surface 500 instead of 403).

#### User flows

N/A — purely server-side enforcement.

#### Permissions & roles

N/A — operates orthogonally to roles. Permission checks are layered on top in route handlers.

#### Data model

Touches every tenant-scoped table. Defines no models of its own.

#### API routes

Used by virtually every authenticated route. The allowlist below tracks the exceptions.

#### Background jobs

Crons (`subscription-billing`, `recurring-billing`, etc.) operate cross-tenant by design and use raw `db`. They are explicitly listed in the allowlist.

#### External integrations

None.

#### Webhooks

None directly. Webhook handlers (Adyen, Twilio, SES) typically resolve the target org from the payload then call `getScopedDb` for tenant-scoped writes.

#### Notifications & emails

None.

#### Configuration

- `SKIP_TENANT_CHECK=1` — bypass pre-commit hook for WIP commits.

#### Lifecycle / state machines

N/A.

#### Business rules & edge cases

- **Public API exception:** `/api/public/*` routes don't have a session; they call `resolvePublicRequest()` ([src/lib/public-api.ts:121-135](../src/lib/public-api.ts#L121-L135)) which derives the org from the Host header. **However**, public routes use raw `db` with manual `where: { organizationId }` filters, NOT `getScopedDb`. See § 0.7.
- **Transactions are not auto-scoped.** Inside `db.$transaction(async (tx) => { ... })`, `tx` is the raw client. Routes must add `where: { id, organizationId }` manually before mutating. Cross-link to ARCHITECTURE.md:175-183.
- **Relation-chain models** (`Payment`, `Enrollment`, `LineItem`, `Attendance`, etc.) lack a direct `organizationId` column and are NOT in `TENANT_MODELS`. They must be filtered through their relation: `payment.invoice.organizationId`, `enrollment.program.organizationId`, etc. (manual; not auto-injected).
- **Duplicate of `findUnique`** behavior: developers expecting "find by primary key" semantics get "find first matching this org" instead. If the unique key collides between orgs (rare but possible for non-id uniques), this matters.

#### Known limitations / gaps

- **CI does not enforce `lint:tenant`.** Only the pre-commit hook does. A `git commit --no-verify` or a force-push from a misconfigured machine can bypass. Fix: add to [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **`$transaction` blocks are an audit hotspot** — no tooling to detect missing manual scoping. New routes using transactions are a recurring source of tenant-isolation bugs.
- **`HTTP status` mapping is inconsistent** — `TenantIsolationError` propagates as a 500 unless the route catches and rethrows as 403. Audit needed.
- **`aggregate` / `groupBy` not intercepted.** Routes using these must scope manually.
- **Allowlist drift** — 305 lines, ~195 active. Periodic prune needed; entries become stale when routes are deleted.

#### Code references

- [src/lib/db.ts:166-376](../src/lib/db.ts#L166-L376) — full `getScopedDb` implementation
- [src/lib/db.ts:174-230](../src/lib/db.ts#L174-L230) — `TENANT_MODELS` array (55 entries)
- [src/lib/db.ts:242-246](../src/lib/db.ts#L242-L246) — `TenantIsolationError` class
- [scripts/tenant-isolation-allowlist.txt](../scripts/tenant-isolation-allowlist.txt) — 305 lines, allowed raw-`db` callers
- [scripts/check-tenant-isolation.sh](../scripts/check-tenant-isolation.sh) — `lint:tenant` checker
- [package.json](../package.json) line ~30 — `"lint:tenant"` script
- [.husky/pre-commit:28-34](../.husky/pre-commit#L28-L34) — pre-commit enforcement
- [docs/BUSINESS-RULES.md § Tenant Isolation](BUSINESS-RULES.md#tenant-isolation) — companion business-rules doc

### 0.3 Authentication & sessions

**Status:** Live · **Plan gate:** Always on · **Portals:** `login.` (issuer), all others (consumer)
**Primary models:** `User`, `Account`, `Session`, `VerificationToken`, `EmailVerificationCode`, `PasswordResetToken`
**Owner / latest major work:** TODO

#### What it does

Centralized authentication via NextAuth.js. All login attempts route through `login.uplifter.app` (or the env-equivalent). After authentication, the session cookie is set on the parent domain (`.uplifter.app` in cloud) so it's shared across all subdomains. In local dev, OAuth callbacks must hit `localhost:3000` (Google rejects `*.localhost`); a custom session-bridge flow then re-issues the cookie on `.uplifter.localhost`. Session JWTs carry the active organization, role, permissions, and superadmin flag.

#### Sub-features

- [x] Email + password (Credentials provider, bcrypt cost 12)
- [x] Google OAuth (conditional on env vars)
- [x] Microsoft Entra ID / Azure AD OAuth (conditional on env vars)
- [x] Email-code login (OTP / magic link)
- [x] MFA via email code for users inactive >30 days (no TOTP)
- [x] Password reset (1-hour token expiry)
- [x] Custom Prisma adapter (avatar mapping, auto-superadmin for staff domains)
- [x] Cross-subdomain session bridge (OAuth & credentials, local-dev only)
- [x] Cookie domain per environment
- [x] Org switcher via `useSession().update()` (no dedicated API endpoint)
- [x] Custom logout (`/api/auth/logout` clears all NextAuth cookie variants)
- [x] OAuth account-linking gate (env-controlled, default OFF)
- [x] Rate limiting (auth, password reset, MFA — Redis sliding window)
- [x] Password complexity policy (12 chars, mixed-case, digit, special)
- [x] Superadmin impersonation (session carries `viewingAsUserId`)
- [ ] **TOTP / authenticator-app MFA** — not implemented

#### Providers ([src/lib/auth.ts](../src/lib/auth.ts))

| Provider                       | Trigger                      | Lines                                   | Notes                                       |
| ------------------------------ | ---------------------------- | --------------------------------------- | ------------------------------------------- |
| Credentials (email + password) | `signIn("credentials", ...)` | [299-367](../src/lib/auth.ts#L299-L367) | bcrypt verify; MFA gate if inactive >30d    |
| Email-code (OTP)               | `signIn("email-code", ...)`  | [368-420](../src/lib/auth.ts#L368-L420) | Validates 6-char alphanumeric or UUID token |
| Google OAuth                   | `signIn("google")`           | [246-264](../src/lib/auth.ts#L246-L264) | Conditional on `GOOGLE_CLIENT_ID`/`SECRET`  |
| Azure AD (Microsoft Entra)     | `signIn("azure-ad")`         | [267-297](../src/lib/auth.ts#L267-L297) | Tenant: `AZURE_AD_TENANT_ID` or `common`    |

#### Custom Prisma adapter (`createUplifterAdapter`, [auth.ts:55-144](../src/lib/auth.ts#L55-L144))

Differences from stock NextAuth Prisma adapter:

1. **Avatar field mapping** — Prisma's `avatar` ↔ NextAuth's `image` ([L70, L90, L134](../src/lib/auth.ts#L70)).
2. **Auto-superadmin for Uplifter staff** — first login from a staff email domain auto-promotes:
   - Domains: `@uplifterinc.com`, `@upliftergymnastics.com`, `@uplifter.app`, `@uplifterincca.onmicrosoft.com` ([L31-36](../src/lib/auth.ts#L31-L36))
   - On user creation: `role = "ADMIN"`, `isSuperAdmin = true` ([L91-92](../src/lib/auth.ts#L91-L92))
   - On existing user OAuth login: re-elevated if domain matches ([L455-456](../src/lib/auth.ts#L455-L456))
3. **Default role for new OAuth users** — `PARENT` for non-staff ([L91](../src/lib/auth.ts#L91)).
4. **`lastActiveAt` set on creation** ([L93](../src/lib/auth.ts#L93)).
5. **`getUserByAccount` override** — prevents OAuthAccountNotLinked race condition ([L116-128](../src/lib/auth.ts#L116-L128)).

#### Session shape ([auth.ts:586-602](../src/lib/auth.ts#L586-L602))

JWT and session both carry:
`id`, `email`, `name`, `role`, `organizationId`, `organizationName`, `permissions[]`, `isSuperAdmin`, `image`, `avatarCrop`, plus impersonation fields `viewingAsUserId`, `viewingAsUserName`, `viewingAsUserEmail` (only set when a superadmin is impersonating).

#### MFA ([src/lib/mfa.ts](../src/lib/mfa.ts))

- **Trigger:** password login when `lastActiveAt` is more than 30 days ago (`MFA_INACTIVITY_DAYS = 30` at [L60](../src/lib/mfa.ts#L60)).
- **Mechanism:** 6-char alphanumeric code emailed (excludes `0/O/1/I/L` for clarity, [L64](../src/lib/mfa.ts#L64)).
- **Code expiry:** 10 minutes (`CODE_EXPIRY_MINUTES = 10`, [L61](../src/lib/mfa.ts#L61)).
- **Storage:** `EmailVerificationCode` table.
- **Bypass:** signed proof token from a recent magic-link login is accepted in lieu of typing the code ([auth.ts:334-346](../src/lib/auth.ts#L334-L346)).
- **TOTP / hardware tokens:** **not implemented**.

#### Password reset

- Request: `POST /api/auth/forgot-password` ([route](../src/app/api/auth/forgot-password/route.ts))
- Token validation: `GET /api/auth/reset-password/[token]` ([route:22-90](../src/app/api/auth/reset-password/[token]/route.ts#L22-L90))
- Reset: `POST /api/auth/reset-password/[token]` ([route:97-186](../src/app/api/auth/reset-password/[token]/route.ts#L97-L186))
- **Token expiry: 1 hour** ([forgot-password/route.ts:14](../src/app/api/auth/forgot-password/route.ts#L14))
- Email template: `password-reset` (placeholders `{{resetUrl}}`, `{{expiresIn}}`) in [src/lib/email.ts](../src/lib/email.ts).

#### Cross-subdomain session bridge

Three local-dev-only endpoints exist because Google OAuth rejects `*.localhost` redirect URIs:

| Endpoint                       | Purpose                                                                                                      | File                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `/api/auth/oauth-bridge`       | After OAuth on `localhost:3000`, mint HMAC bridge token, redirect to session-bridge on `.uplifter.localhost` | [route](../src/app/api/auth/oauth-bridge/route.ts)       |
| `/api/auth/session-bridge`     | Verify bridge token, re-encode JWT, set cookie on `.uplifter.localhost` (or cloud equiv.)                    | [route](../src/app/api/auth/session-bridge/route.ts)     |
| `/api/auth/credentials-bridge` | Same flow but for password login                                                                             | [route](../src/app/api/auth/credentials-bridge/route.ts) |

Bridge tokens are HMAC-signed with **60-second expiry** ([oauth-bridge/route.ts:84-91](../src/app/api/auth/oauth-bridge/route.ts#L84-L91)). Cookie max-age is 30 days ([session-bridge/route.ts:160-194](../src/app/api/auth/session-bridge/route.ts#L160-L194)).

In cloud envs, OAuth completes directly on `login.uplifter.app` and the cookie is set on `.uplifter.app`, sharing across all subdomains without bridge endpoints.

#### Cookie domain ([src/lib/auth-cookies.ts](../src/lib/auth-cookies.ts))

- Local: `.uplifter.localhost` ([L53](../src/lib/auth-cookies.ts#L53))
- Cloud: `config.cookieDomain` from `env-domains.ts` ([L43](../src/lib/auth-cookies.ts#L43))

#### Org switcher

- Component: [src/components/organization-switcher.tsx:75-81](../src/components/organization-switcher.tsx#L75-L81) calls `update({ organizationId, organizationName })` on the NextAuth session.
- This triggers JWT callback with `trigger === "update"` ([auth.ts:545-562](../src/lib/auth.ts#L545-L562)) which re-resolves permissions via `buildAuthorizedUser()`.
- **No dedicated API endpoint** — session update is built into NextAuth client.

#### Sign-out

- `POST/GET /api/auth/logout` ([route:54-116](../src/app/api/auth/logout/route.ts#L54-L116))
- Clears all NextAuth cookie variants (`sessionToken`, `callback-url`, `csrf-token`, `__Secure-` prefixed) with `maxAge: 0` on the shared domain ([L31-52](../src/app/api/auth/logout/route.ts#L31-L52)).
- Redirects to `login.{baseDomain}/login`.

#### Account linking

- Each OAuth provider (Google, Azure) creates its own `Account` row.
- Two `Account` rows can link to the same `User` only if `ALLOW_OAUTH_ACCOUNT_LINKING=true`.
- **Default: OFF.** Existing user with a password who tries OAuth login from the same email is rejected unless an `Account` row already exists ([auth.ts:443-452](../src/lib/auth.ts#L443-L452)).

#### Rate limiting ([src/lib/rate-limit.ts](../src/lib/rate-limit.ts))

| Surface        | Limit  | Window | Line                                |
| -------------- | ------ | ------ | ----------------------------------- |
| Auth (login)   | 30 req | 60s    | [L35](../src/lib/rate-limit.ts#L35) |
| Password reset | 10 req | 5 min  | [L37](../src/lib/rate-limit.ts#L37) |
| MFA challenge  | 20 req | 5 min  | [L43](../src/lib/rate-limit.ts#L43) |

Implementation: Redis ZSET sliding window. Client IP via X-Forwarded-For / X-Real-IP / Cloudflare headers ([L151-171](../src/lib/rate-limit.ts#L151-L171)).

#### Password policy ([src/lib/password.ts:14-22](../src/lib/password.ts#L14-L22))

PCI-DSS v4.0 compliant:

- Minimum **12 characters** ([L14](../src/lib/password.ts#L14))
- ≥1 uppercase, ≥1 lowercase, ≥1 digit, ≥1 special from `[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]`
- `validatePassword()` returns first failing rule or `null`.

#### User flows

**New parent signs up via Google:**

1. Click "Sign in with Google" on `login.uplifter.app`.
2. Google OAuth → callback to NextAuth.
3. Adapter `createUser` runs ([auth.ts:78-94](../src/lib/auth.ts#L78-L94)) → creates `User` with `role: "PARENT"`, `isSuperAdmin: false`, `lastActiveAt: now()`.
4. JWT issued, cookie set on `.uplifter.app`.
5. Redirect to `callbackUrl` (e.g. `athletes.uplifter.app`).

**Returning admin logs in with email + password (inactive >30d):**

1. Submits credentials at `login.uplifter.app/login`.
2. Credentials provider verifies bcrypt hash ([auth.ts:299-367](../src/lib/auth.ts#L299-L367)).
3. `shouldRequireMfa(lastActiveAt)` returns true → MFA challenge page.
4. 6-char code emailed; user enters; verified.
5. JWT issued.

**Org switcher:**

1. Admin clicks org switcher (sidebar component).
2. `useSession().update({ organizationId, organizationName })`.
3. JWT callback re-resolves `permissions` for the new org via `buildAuthorizedUser`.
4. UI re-renders with new org context (no full page reload required).

#### Permissions & roles

This feature defines `role` and `permissions[]` on the session — those values are then consumed by everything downstream. See § 0.5 for role/permission definitions.

#### Data model

- `User` ([prisma/schema.prisma:240-309](../prisma/schema.prisma#L240-L309))
- `Account`, `Session`, `VerificationToken` (NextAuth primitives)
- `EmailVerificationCode` (codes for OTP + MFA)
- `PasswordResetToken` (TODO: confirm exact model name)

#### API routes

- `/api/auth/[...nextauth]` — NextAuth handler
- `/api/auth/forgot-password`
- `/api/auth/reset-password/[token]`
- `/api/auth/oauth-bridge`
- `/api/auth/session-bridge`
- `/api/auth/credentials-bridge`
- `/api/auth/logout`

#### Background jobs

None directly. (User cleanup of stale `Session` / `VerificationToken` rows happens in the `cleanup` cron — see § 4.1.)

#### External integrations

- Google OAuth, Microsoft Entra ID — see § 4.3 registry.
- AWS SES (or MailHog locally) — for password reset, verification, and MFA emails.

#### Webhooks

None.

#### Notifications & emails

- `password-reset` template
- `email-verification` / OTP code email
- MFA challenge email
- (TODO: enumerate all auth-related templates from `src/lib/email.ts`)

#### Configuration

| Env var                                         | Purpose                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `NEXTAUTH_SECRET`                               | JWT signing secret                                                   |
| `NEXTAUTH_URL`                                  | OAuth callback base URL                                              |
| `GOOGLE_CLIENT_ID` / `_SECRET`                  | Google OAuth (provider conditional)                                  |
| `AZURE_AD_CLIENT_ID` / `_SECRET` / `_TENANT_ID` | Microsoft Entra (provider conditional)                               |
| `ALLOW_OAUTH_ACCOUNT_LINKING`                   | Allow OAuth login on existing email-account (default false)          |
| `BRIDGE_TOKEN_SECRET`                           | HMAC secret for OAuth/credentials bridge tokens (TODO: confirm name) |

#### Lifecycle / state machines

**User status:** TODO: enumerate `User.status` values (likely `ACTIVE | INVITED | INACTIVE` — confirm against schema).

**Session lifetime:** 30 days (cookie max-age).

#### Business rules & edge cases

- **MFA does not apply to OAuth.** Google/Entra logins skip the MFA-on-inactivity check — those providers are themselves the second factor.
- **Staff-domain auto-elevation is sticky.** A user whose email matches a staff domain is re-elevated to `isSuperAdmin: true` on every OAuth login, even if a superadmin manually unset it. This is intentional but means demoting Uplifter staff requires removing them from the staff-domain list.
- **`PARENT` is the default for OAuth users**, regardless of which portal initiated the login. Staff invited to non-Uplifter domains must accept an invite (§ 0.6) — they cannot self-promote via OAuth.
- **Org switcher does not persist server-side.** It updates the JWT in place. If a user's session is loaded fresh (e.g. on another device), they default back to whatever org `User.lastOrganizationId` (or equivalent) was last persisted to. (TODO: verify exact persistence mechanism.)
- **Bridge tokens expire in 60s** — slow networks during local dev can hit this. Bumping requires changing both `oauth-bridge` and `session-bridge`.
- **Rate-limit failure mode** differs by env: in dev, fails closed if Redis missing; in prod, permissive if Redis missing ([rate-limit.ts](../src/lib/rate-limit.ts)). Document this discrepancy.

#### Known limitations / gaps

- **No TOTP / hardware-token MFA.** Email-only second factor.
- **Password change inside the app is not in the athlete account page** ([accounts page review](../src/app/athletes/account/page.tsx)) — TODO: locate the actual change-password UI for logged-in users (if any) or confirm it's reset-flow only.
- **Email change is forbidden** for end users (athletes account page calls it out: "Email cannot be changed as it is used for login"). Requires admin DB intervention.
- **Session re-issue on permission change is not automatic.** If a superadmin changes a user's permissions, the user must re-login or org-switch for the new permissions to load.
- **`PasswordResetToken` model name** not confirmed in this audit.
- **Bridge token length / collision risk** TODO.

#### Code references

- [src/lib/auth.ts](../src/lib/auth.ts) — NextAuth config + custom adapter (~750 lines)
- [src/lib/auth-cookies.ts](../src/lib/auth-cookies.ts) — domain-aware cookie config
- [src/lib/mfa.ts](../src/lib/mfa.ts) — MFA gate + code generation
- [src/lib/password.ts:14-52](../src/lib/password.ts#L14-L52) — password policy + validator
- [src/lib/rate-limit.ts:33-48,151-171](../src/lib/rate-limit.ts#L33-L171) — rate limit config + IP extraction
- [src/app/api/auth/oauth-bridge/route.ts](../src/app/api/auth/oauth-bridge/route.ts) — local-dev OAuth bridge
- [src/app/api/auth/session-bridge/route.ts](../src/app/api/auth/session-bridge/route.ts) — cross-subdomain cookie issuer
- [src/app/api/auth/credentials-bridge/route.ts](../src/app/api/auth/credentials-bridge/route.ts) — local-dev password bridge
- [src/app/api/auth/logout/route.ts](../src/app/api/auth/logout/route.ts) — custom multi-cookie logout
- [src/app/api/auth/forgot-password/route.ts](../src/app/api/auth/forgot-password/route.ts) — password reset request
- [src/app/api/auth/reset-password/[token]/route.ts](../src/app/api/auth/reset-password/[token]/route.ts) — password reset complete
- [src/components/organization-switcher.tsx:75-81](../src/components/organization-switcher.tsx#L75-L81) — org switcher

### 0.4 Organization lifecycle

**Status:** Live · **Plan gate:** Always on · **Portals:** `startup.` (signup), `admin.` (cancel), `superadmin.` (status mgmt)
**Primary models:** `Organization`, `OrganizationStatusLog`, `OrganizationSubscription`, `Referral`, `WebsiteConfig`
**Owner / latest major work:** TODO

#### What it does

End-to-end lifecycle of an organization (tenant): self-service signup, plan assignment with trial, ongoing operation, and deactivation/reactivation paths (both customer-initiated and superadmin-managed). Side effects on deactivation include voiding pending invoices, removing the Adyen allowed-origin, and pausing the subscription.

#### Sub-features

- [x] Self-service signup wizard at `startup.uplifter.app` (4 steps)
- [x] Subdomain availability check & format validation (cross-link § 0.1)
- [x] Initial admin user creation (User + OrganizationMember, both `ADMIN`)
- [x] Plan selection at signup (free, monthly, yearly tiers)
- [x] 30-day trial for paid plans (`TRIALING` status)
- [x] Adyen allowed-origin registration (CORS allowlist)
- [x] Customer-initiated deactivation (subscription cancel)
- [x] Superadmin deactivation with reason categorization
- [x] Self-serve reactivation (only when previously cancelled by customer)
- [x] Superadmin reactivation (no restrictions)
- [x] `OrganizationStatusLog` audit trail
- [x] Referral via `?ref=` URL parameter at signup
- [x] 8-character hex referral code generation per org
- [x] Hard-delete script (developer-only, requires production flag)
- [x] Adyen Balance Platform onboarding (deferred — manual trigger post-signup)
- [x] Superadmin grace-period manager
- [x] Superadmin feature-overrides UI
- [x] Subscription `isLocked` flag (prevents plan changes)
- [ ] **Organization rename / subdomain change** — NOT supported (subdomain is immutable)
- [ ] **Hard-delete UX in product** — script-only

#### Signup wizard ([src/app/org-signup/page.tsx:103-205](../src/app/org-signup/page.tsx#L103-L205))

4 steps:

1. **Account** — email, password, name (new user) OR existing session.
2. **Organization** — orgName, orgEmail, phone, street, city, stateProvince, postalCode, country.
3. **Website & Branding** — subdomain, primaryColor (hex), secondaryColor (hex).
4. **Plan** — planId selection.

POST endpoint: `POST /api/org-signup` ([route](../src/app/api/org-signup/route.ts))

Side effects on success ([org-signup/route.ts](../src/app/api/org-signup/route.ts)):

- Create `Organization` with generated `referralCode` ([L178-189](../src/app/api/org-signup/route.ts#L178-L189))
- Create `User` (new) or fetch (existing) → set `role: "ADMIN"`, `status: "ACTIVE"`
- Create `OrganizationMember` with `role: "ADMIN"`
- Create `WebsiteConfig` with subdomain
- Create `OrganizationSubscription` with `status: "TRIALING"` (paid) or `"ACTIVE"` (free) ([L265-277](../src/app/api/org-signup/route.ts#L265-L277))
- Set `trialEndsAt = now + 30d` for paid plans ([L162-166](../src/app/api/org-signup/route.ts#L162-L166))
- If `?ref=` present and matches an existing `Organization.referralCode`, create `Referral` row ([L302-314](../src/app/api/org-signup/route.ts#L302-L314))
- Call `registerAllowedOrigin(subdomain)` to add the new subdomain to Adyen's CORS allowlist ([L388](../src/app/api/org-signup/route.ts#L388))

**Adyen Balance Platform onboarding is deferred** — only the CORS origin is registered at signup. The full KYC flow (Legal Entity, Business Line, Account Holder) is initiated later via `/api/organization/adyen-onboarding`.

#### Trial behavior

- Paid plans: 30-day trial → `status: "TRIALING"`, `trialEndsAt` set.
- Free plans: no trial → `status: "ACTIVE"`, `trialEndsAt: null`.
- Constant: `FREE_TRIAL_DAYS = 30` ([src/lib/billing-config.ts:2](../src/lib/billing-config.ts#L2)).
- Trial-ending notifications: TODO (verify in `subscription-billing` cron behavior).

#### Status transitions

```
   (signup, paid plan)               (signup, free plan)
         |                                  |
         v                                  v
     TRIALING ──(payment success)──> ACTIVE
                                       │
                  ┌────────────────────┤
                  │ customer cancels   │ superadmin deactivates
                  │ /api/.../cancel    │ /api/superadmin/.../status
                  v                    v
              CANCELLED             PAUSED      ◄── subscription
                  │                    │             status
                  │ customer reactivates  superadmin reactivates
                  │ (only if prior reason   (anytime)
                  │  was "Requested by      │
                  │  customer")             │
                  └────────────┬────────────┘
                               v
                            ACTIVE

   Organization.isActive: false during CANCELLED or PAUSED, true when ACTIVE/TRIALING
```

Subscription dunning lifecycle (TRIALING → ACTIVE → PAST_DUE → DEACTIVATED) is documented separately in [BUSINESS-RULES.md § Subscription Billing Lifecycle](BUSINESS-RULES.md#subscription-billing-lifecycle).

#### Deactivation paths

**Customer-initiated:** `/api/organization/subscription/cancel` ([route:48-94](../src/app/api/organization/subscription/cancel/route.ts#L48-L94))

- Sets `Organization.isActive = false`, `deactivatedAt = now()`, `deactivatedBy = userId`, `deactivationReason = "Requested by customer"`
- Subscription status → `CANCELLED`
- Pending invoices voided
- `removeAllowedOrigin(subdomain)` called
- `OrganizationStatusLog` row inserted (`action: "DEACTIVATED"`)

**Superadmin-initiated:** `/api/superadmin/organizations/[id]/status` POST ([route:62-100](../src/app/api/superadmin/organizations/[id]/status/route.ts#L62-L100))

- Same field updates as customer-initiated, but `deactivationReason` is one of 5 categories:
  - `Non-payment`
  - `Requested by customer`
  - `Policy violation`
  - `Inactivity`
  - `Other`
- Subscription status → `PAUSED` (not `CANCELLED`).
- Reason + optional notes captured.
- `removeAllowedOrigin(subdomain)` called.
- `OrganizationStatusLog` row with `performedBy = superadmin's userId`.

#### Reactivation paths

**Customer self-serve:** `/api/organization/reactivate` ([route](../src/app/api/organization/reactivate/route.ts))

- **Restriction 1 — reason:** only allowed when `deactivationReason === "Requested by customer"` ([L67-72](../src/app/api/organization/reactivate/route.ts#L67-L72)). Other reasons return `403` with "Please contact support."
- **Restriction 2 — permission:** caller must hold `*` or `settings.edit` permission ([L42-52](../src/app/api/organization/reactivate/route.ts#L42-L52)) — not just any active membership. Reactivation is gated like a sensitive admin action.
- The route does NOT use the session's active org (which won't include the deactivated org by definition). Instead it accepts `organizationId` in the body and verifies an `ACTIVE` membership for the caller in that specific org.
- Clears `deactivatedAt`, `deactivatedBy`, `deactivationReason`, `deactivationNotes`, `scheduledDeactivationDate`, and `dunningWarningsSent`.
- Subscription updated to `ACTIVE` ONLY if it was previously `CANCELLED` ([L88-97](../src/app/api/organization/reactivate/route.ts#L88-L97)) — other subscription states are left alone.
- `registerAllowedOrigin(subdomain)` re-called (fire-and-forget via `void`).
- `OrganizationStatusLog` row (`action: "REACTIVATED"`, `reason: "Self-serve reactivation by customer"`).

**Superadmin reactivation:** `/api/superadmin/organizations/[id]/status` ([route:107-145](../src/app/api/superadmin/organizations/[id]/status/route.ts#L107-L145))

- No restrictions — superadmin can reactivate any deactivated org regardless of reason.

#### Referrals

- **Capture:** `?ref=ABC12345` query param read at [org-signup/page.tsx:114](../src/app/org-signup/page.tsx#L114), passed to POST as `referralCode`.
- **Validation:** matched against existing `Organization.referralCode` in `Referral` table creation ([org-signup/route.ts:302-314](../src/app/api/org-signup/route.ts#L302-L314)).
- **Code format:** 8-char hex uppercase, `/^[A-F0-9]{8}$/` ([src/lib/referral.ts:5](../src/lib/referral.ts#L5)).
- **Generation:** crypto-random with collision check, up to 5 retries ([referral.ts:7-9](../src/lib/referral.ts#L7-L9)).
- **Effect:** referrer accrues credit months (cross-link § 3.7 Referrals).

#### `OrganizationStatusLog` ([prisma/schema.prisma:4778-4791](../prisma/schema.prisma#L4778-L4791))

| Field            | Type     | Notes                                                |
| ---------------- | -------- | ---------------------------------------------------- |
| `id`             | cuid     |                                                      |
| `organizationId` | string   | FK                                                   |
| `action`         | string   | Currently observed: `"DEACTIVATED"`, `"REACTIVATED"` |
| `reason`         | string?  | Free-form                                            |
| `notes`          | string?  | Free-form                                            |
| `performedBy`    | string?  | userId, NULL for system/cron actions                 |
| `performedAt`    | DateTime |                                                      |

**System actor convention:** `performedBy = null` distinguishes cron-triggered events from user-triggered ones. The cron-triggered deactivation path (subscription dunning) uses this; explicit superadmin actions populate it.

#### Hard delete

- Script: [scripts/delete-organization-by-slug.ts](../scripts/delete-organization-by-slug.ts) — manual invocation only.
- Production safeguard: requires `--yes-delete-production-data` flag.
- Uses Prisma cascade to delete the org and all dependent rows.
- **No product UI exists** — soft deactivation is the standard path.

#### Superadmin operations

Beyond status changes:

- **Grace-period manager** — UI to manually adjust `scheduledDeactivationDate` ([src/app/superadmin/organizations/[slug]/grace-period-manager.tsx](../src/app/superadmin/organizations/[slug]/grace-period-manager.tsx))
- **Feature overrides** — per-org toggle UI ([src/app/superadmin/organizations/[slug]/feature-overrides.tsx](../src/app/superadmin/organizations/[slug]/feature-overrides.tsx))
- **Stored payment methods** — view/delete `OrganizationPaymentMethod` rows
- **Subscription lock** — `OrganizationSubscription.isLocked` ([prisma/schema.prisma:3435](../prisma/schema.prisma#L3435)) prevents the org from changing plans

#### Permissions & roles

- Signup: unauthenticated (anyone can sign up).
- Customer cancel/reactivate: requires `ADMIN` role on the org.
- Superadmin status mgmt: requires `isSuperAdmin = true`.

#### Data model

See `Organization` in [prisma/schema.prisma](../prisma/schema.prisma) for the full field list. Key lifecycle fields:

- `isActive` (boolean)
- `deactivatedAt`, `deactivatedBy`, `deactivationReason`, `deactivationNotes`
- `scheduledDeactivationDate` (set by dunning cron)
- `referralCode` (unique, 8-char hex)
- `slug` (used in some legacy paths; canonical subdomain lives on `WebsiteConfig.subdomain`)

#### API routes

| Route                                       | Method    | Purpose                                       |
| ------------------------------------------- | --------- | --------------------------------------------- |
| `/api/org-signup`                           | POST      | Create org + admin + subscription             |
| `/api/org-signup/check-subdomain`           | GET       | Live subdomain availability                   |
| `/api/org-signup/plans`                     | GET       | List available plans                          |
| `/api/organization/subscription/cancel`     | POST      | Customer-initiated deactivation               |
| `/api/organization/reactivate`              | POST      | Customer self-serve reactivation              |
| `/api/organization/adyen-onboarding`        | GET, POST | Begin/resume Adyen KYC (deferred from signup) |
| `/api/superadmin/organizations/[id]/status` | POST      | Superadmin status change                      |

#### Background jobs

- `subscription-billing` — generates monthly invoices, advances `nextBillingDate`.
- `subscription-dunning` — daily; retries failed invoices, sends warnings, deactivates orgs past `scheduledDeactivationDate`.

These crons own the `TRIALING` → `ACTIVE` → `PAST_DUE` → `DEACTIVATED` transitions; see [BUSINESS-RULES.md § Subscription Billing Lifecycle](BUSINESS-RULES.md#subscription-billing-lifecycle).

#### External integrations

- **Adyen Management API** — `registerAllowedOrigin` / `removeAllowedOrigin` for the org's subdomain.
- **Adyen Balance Platform** — KYC onboarding (deferred from signup).

#### Webhooks

None directly. Subscription billing webhooks (Adyen payment events) are handled in § 3.3.

#### Notifications & emails

TODO: enumerate. Likely includes: signup welcome, trial-ending warning, deactivation confirmation, dunning warnings (30d/7d/1d).

#### Configuration

| Env var                    | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `FREE_TRIAL_DAYS`          | (constant in `billing-config.ts`, not env) — 30 days |
| Adyen Management API creds | For allowed-origin calls                             |

#### Lifecycle / state machines

See diagram above. Note that `Organization.isActive` and `OrganizationSubscription.status` track related-but-distinct state; the dunning cron and the customer-cancel path move them together.

#### Business rules & edge cases

- **Customer reactivation is restricted by reason.** Only `"Requested by customer"` deactivations are self-serve to reactivate. Non-payment / policy-violation deactivations require superadmin to prevent users from re-enabling without resolving the underlying issue.
- **Subscription status differs by deactivation path.** Customer-initiated → `CANCELLED`; superadmin-initiated → `PAUSED`. Reactivation logic uses these to pick the right pre-deactivation snapshot to restore.
- **Adyen origin is removed on deactivation.** The org's marketing site can no longer initiate payments. Re-registering happens during reactivation.
- **Subdomain immutability.** Once chosen, it's permanent. The Adyen allowed-origin, all customer-facing URLs, and any external links bake in the subdomain.
- **Referral self-attribution is possible if not blocked.** TODO: verify whether the referral validation rejects `Org.referralCode === own org's code` (it shouldn't be possible since the org doesn't exist yet at signup, but worth confirming).
- **Trial → first paid invoice transition** happens via the `subscription-billing` cron on the 1st of the month after `trialEndsAt` passes. There is no explicit "trial ends" event.
- **`Referral.creditMonths` consumption** happens during `subscription-billing` until `creditMonthsUsed == creditMonths`.

#### Known limitations / gaps

- **No org rename / subdomain change.** Customers must hard-delete and re-signup if they want a different subdomain. Hard-delete is script-only.
- **No org rename for display name (`Organization.name`)** — TODO: verify whether display-name changes are allowed via admin settings.
- **No deletion UI for end customers.** GDPR/data-removal requests require manual operator action.
- **`OrganizationStatusLog.action` is a free-string field** — values not constrained by enum. Drift risk.
- **Trial-ending warning notifications** — TODO: confirm whether these exist or only dunning warnings post-trial.
- **Org email change after signup** — TODO: locate the admin route, if any.

#### Code references

- [src/app/org-signup/page.tsx:103-205](../src/app/org-signup/page.tsx#L103-L205) — wizard
- [src/app/api/org-signup/route.ts:178-388](../src/app/api/org-signup/route.ts#L178-L388) — signup transaction
- [src/app/api/organization/subscription/cancel/route.ts:48-94](../src/app/api/organization/subscription/cancel/route.ts#L48-L94) — customer cancel
- [src/app/api/organization/reactivate/route.ts:74-111](../src/app/api/organization/reactivate/route.ts#L74-L111) — customer reactivate
- [src/app/api/superadmin/organizations/[id]/status/route.ts:62-145](../src/app/api/superadmin/organizations/[id]/status/route.ts#L62-L145) — superadmin status
- [src/lib/referral.ts:1-9](../src/lib/referral.ts#L1-L9) — referral code generation
- [src/lib/billing-config.ts:2](../src/lib/billing-config.ts#L2) — `FREE_TRIAL_DAYS`
- [scripts/delete-organization-by-slug.ts](../scripts/delete-organization-by-slug.ts) — hard-delete script
- [prisma/schema.prisma:4778-4791](../prisma/schema.prisma#L4778-L4791) — `OrganizationStatusLog`
- [docs/BUSINESS-RULES.md § Subscription Billing Lifecycle](BUSINESS-RULES.md#subscription-billing-lifecycle) — dunning rules

### 0.5 Users, members, roles, permissions

**Status:** Live · **Plan gate:** Always on · **Portals:** all
**Primary models:** `User`, `OrganizationMember`, `OrgMemberPermission`
**Owner / latest major work:** TODO

#### What it does

Defines the identity model: a **global `User`** (the human) can have **many `OrganizationMember`** rows (their relationship with each org they belong to). Each `OrganizationMember` carries a `role` and — when the role is `CUSTOM` — a set of granular permission rows. The current session's "active org" determines which `OrganizationMember` row's permissions are loaded into the JWT.

#### Sub-features

- [x] Global `User` separate from per-org `OrganizationMember`
- [x] 6-value `Role` enum (`ADMIN`, `COACH`, `VOLUNTEER`, `ACCOUNTANT`, `CUSTOM`, `PARENT`)
- [x] Boolean `isSuperAdmin` flag on `User` (separate from role)
- [x] Multi-org membership per user
- [x] Org switcher (cross-link § 0.3)
- [x] CUSTOM role granular permissions via `OrgMemberPermission` table
- [x] 30+ predefined permission keys
- [x] Wildcard `*` permission for full access
- [x] User profile fields (avatar, name, phone, etc.)
- [x] Avatar upload + crop metadata
- [x] Phone verification via OTP
- [x] SMS / email opt-out flags + TCPA consent fields
- [x] Account self-service page (athletes portal)
- [x] Hard-delete user endpoint
- [x] Staff management UI (`/dashboard/organization/staff`)
- [x] Member status lifecycle (`ACTIVE | INVITED | INACTIVE`)
- [ ] **Email change** — explicitly forbidden ("Email cannot be changed")
- [ ] **Soft delete / GDPR** — hard delete only
- [ ] **Password change page for logged-in users** — TODO: locate

#### Models

**`User`** ([prisma/schema.prisma:240-309](../prisma/schema.prisma#L240-L309)) — global identity
| Field | Notes |
|---|---|
| `id`, `email` (unique), `name`, `passwordHash` | Core auth |
| `avatar`, `avatarCrop` (JSON) | Profile image + crop coords |
| `phone`, `phoneVerified` | E.164 + OTP-verified flag |
| `role` | Default `COACH` — but typically overridden by adapter logic at signup |
| `status` | `ACTIVE | INVITED | INACTIVE` |
| `isSuperAdmin` | Boolean — Uplifter staff only |
| `lastActiveAt` | Powers MFA-on-inactivity gate (§ 0.3) |
| `termsAcceptedAt` | TOS acceptance |
| `smsOptOut`, `smsOptOutAt`, `smsConsentAt`, `smsConsentSource`, `smsConsentIp`, `smsConsentVersion`, `smsConsentRevokeSource` | TCPA — see § 1.20 |
| `emailOptOut`, `emailOptOutAt` | Email subscription state |
| `balance` | TODO: confirm — likely user-credit balance |

**`OrganizationMember`** ([prisma/schema.prisma:194-232](../prisma/schema.prisma#L194-L232)) — per-org relationship
| Field | Notes |
|---|---|
| `organizationId`, `userId` | FK pair (unique constraint at [L231](../prisma/schema.prisma#L231)) |
| `role` | One of the 6 enum values |
| `status` | `ACTIVE | INVITED | INACTIVE` |
| `joinedAt`, `updatedAt` | |
| `employmentType`, `title`, `hourlyRate`, `hireDate` | HR fields (staff only) |
| `certifications` (JSON) | Coaching certs |
| `phone` | Override of `User.phone` per org (TODO: confirm UX) |
| `emergencyContact` (JSON) | |
| `permissions` (relation) | → `OrgMemberPermission[]` (only populated for `CUSTOM` role) |

**`OrgMemberPermission`** ([prisma/schema.prisma:417-425](../prisma/schema.prisma#L417-L425)) — CUSTOM-role permissions
| Field | Notes |
|---|---|
| `id`, `memberId` | FK to `OrganizationMember` |
| `permission` | String key (see catalog below) |
| Unique constraint | `(memberId, permission)` |

#### Role enum ([prisma/schema.prisma:457-464](../prisma/schema.prisma#L457-L464))

| Value        | Semantic                                                        |
| ------------ | --------------------------------------------------------------- |
| `ADMIN`      | Full access to org's admin portal                               |
| `COACH`      | Coach portal access; lesson plans, attendance, evaluations      |
| `VOLUNTEER`  | Limited operational access (TODO: confirm scope)                |
| `ACCOUNTANT` | Financial views; QBO/Xero integration access                    |
| `CUSTOM`     | Permissions resolved from `OrgMemberPermission` rows            |
| `PARENT`     | Athlete portal access; manages their own athletes/registrations |

There is **no `SUPER_ADMIN` role**. Superadmin status is the `User.isSuperAdmin` boolean ([prisma/schema.prisma:251](../prisma/schema.prisma#L251)).

#### Superadmin

- Identified by `User.isSuperAdmin = true`.
- Auto-set on first login from staff email domains (see § 0.3 adapter).
- **Excluded from user lists** in admin UIs ([src/app/api/users/route.ts:41](../src/app/api/users/route.ts#L41)) — uplifter staff don't show up in customer-facing user pickers.

#### Permission catalog ([src/lib/permissions.ts:5-60](../src/lib/permissions.ts#L5-L60))

| Group             | Permissions                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **General**       | `dashboard.view`, `settings.view`, `settings.edit`                                                 |
| **Athletes**      | `athletes.view`, `athletes.create`, `athletes.edit`, `athletes.delete`                             |
| **Families**      | `families.view`, `families.create`, `families.edit`, `families.delete`                             |
| **Training**      | `training.view`, `training.create`, `training.edit`, `training.delete`                             |
| **Events**        | `events.view`, `events.create`, `events.edit`, `events.delete`                                     |
| **Coaching**      | `coaching.portal`, `coaching.assign`, `coaching.attendance`, `coaching.evaluations`                |
| **Financials**    | `financials.view`, `financials.create`, `financials.edit`, `financials.delete`, `financials.admin` |
| **Users**         | `users.view`, `users.create`, `users.edit`, `users.delete`                                         |
| **Communication** | `communication.view`, `communication.send`                                                         |
| **Wildcard**      | `*` (all permissions, used for ADMIN-equivalent CUSTOM roles)                                      |

#### Permission helpers ([src/lib/permissions.ts:327-348](../src/lib/permissions.ts#L327-L348))

- `hasPermission(permissions, key)` — returns true if `*` or exact match
- `hasAnyPermission(permissions, keys[])` — any-of
- `hasAllPermissions(permissions, keys[])` — all-of

**Canonical guard pattern** (e.g. [src/app/api/users/[id]/route.ts:63-65](../src/app/api/users/[id]/route.ts#L63-L65)):

```ts
if (!session.user.permissions.includes("*") && !session.user.permissions.includes("users.edit")) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

#### Multi-org membership

- A `User` can have N `OrganizationMember` rows (unique on `(orgId, userId)`).
- Active org lives on the JWT (`session.user.organizationId`).
- Switching orgs:
  - UI: [/switch-organization](<../src/app/(auth)/switch-organization/page.tsx>) page lists user's orgs, click to select.
  - Mechanism: `useSession().update({ organizationId, organizationName })` ([page.tsx:79](<../src/app/(auth)/switch-organization/page.tsx#L79>)) → JWT callback re-resolves permissions for the new org → `router.refresh()`.
  - **No dedicated API endpoint.**

#### User flows

**Admin invites a new coach:**

1. Admin opens `/dashboard/organization/staff`, clicks "Invite".
2. Submits form: email, name, role=`COACH`.
3. POST `/api/users` → creates `User` (status=`INVITED`, no passwordHash) + `OrganizationMember` (status=`INVITED`, role=`COACH`) + `OrganizationInvitation` (status=`PENDING`).
4. Email sent with invite link. (Cross-link § 0.6 for full invitation flow.)

**Coach accepts invite, joins, then is invited to a second org:**

1. Coach accepts → `User.status = ACTIVE`, `OrganizationMember.status = ACTIVE` for org A.
2. Logs in. Active org = A. JWT permissions resolved from org A's `OrganizationMember`.
3. Later, admin of org B invites the same email. New `OrganizationMember` row created for org B.
4. Coach accepts (existing-user flow, no password creation). New row activated.
5. On next login or via switcher, they can pick org A or org B.

**Parent edits their profile:**

1. Visits `athletes.uplifter.app/account`.
2. Edits name → saved.
3. Edits phone → triggers OTP → enters code → `phoneVerified = true`.
4. Toggles SMS consent → updates 5-field consent block via `buildSmsConsentGrant` / `Revoke` (cross-link § 1.20).
5. Email field is read-only.

#### Permissions & roles for managing users

- Inviting / editing staff: `users.create` / `users.edit` (or `*`).
- Deleting staff: `users.delete` (cannot self-delete, [api/users/[id]/route.ts:168-169](../src/app/api/users/[id]/route.ts#L168-L169)).
- Editing own profile: implicit (any authenticated user can edit their own `User` row via account page).
- Superadmin can manage any user across orgs from `superadmin.` portal.

#### Data model

See above. Relationships:

```
User 1 ─< OrganizationMember >─ 1 Organization
                │
                └─< OrgMemberPermission   (only for role=CUSTOM)
```

#### API routes

| Route                         | Method  | Purpose                                      |
| ----------------------------- | ------- | -------------------------------------------- |
| `/api/users`                  | GET     | List org members (excludes Uplifter staff)   |
| `/api/users`                  | POST    | Invite new staff member                      |
| `/api/users/[id]`             | GET     | Member details                               |
| `/api/users/[id]`             | PATCH   | Edit role / permissions / employment fields  |
| `/api/users/[id]`             | DELETE  | Hard delete (`users.delete` required)        |
| `/api/avatar`                 | POST    | Upload avatar (5 MB max)                     |
| `/api/avatar`                 | DELETE  | Remove avatar                                |
| `/api/account/...`            | various | Self-service account edits (TODO: enumerate) |
| `/api/organization/staff`     | GET     | Staff listing (admin variant)                |
| `/switch-organization` (page) | —       | Org switcher UI                              |

#### Background jobs

None directly. (User cleanup happens in `cleanup` cron — see § 4.1.)

#### External integrations

- **S3 / MinIO** for avatar storage ([src/app/api/avatar/route.ts:77-98](../src/app/api/avatar/route.ts#L77-L98)).
- **Twilio** for phone OTP verification.

#### Webhooks

None.

#### Notifications & emails

- Invitation emails (cross-link § 0.6).
- Phone OTP (Twilio).
- TODO: enumerate other user-lifecycle emails (welcome, role change, etc.).

#### Configuration

| Env var          | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `USE_S3_STORAGE` | Avatar upload to S3 vs local FS                                                |
| Avatar max size  | 5 MB hard-coded ([api/avatar/route.ts:46](../src/app/api/avatar/route.ts#L46)) |

#### Lifecycle / state machines

**`User.status`:** `INVITED → ACTIVE` (on invite acceptance). `INACTIVE` is set manually.
**`OrganizationMember.status`:** `INVITED → ACTIVE` (on acceptance) → `INACTIVE` (on removal).

#### Business rules & edge cases

- **`User.email` is the global key.** A user can be a `PARENT` in one org and an `ADMIN` in another. The org-scoped role lives on `OrganizationMember`, not `User`.
- **`User.role` is the fallback when no active membership applies.** [auth.ts:201](../src/lib/auth.ts#L201) resolves the session role as `membership?.role || user.role` — so when a user has no active `OrganizationMember` for the current org (e.g. before invitation acceptance, or a superadmin browsing without an org context), `User.role` is what the JWT carries. Same for permissions ([auth.ts:212](../src/lib/auth.ts#L212)) — `ROLE_PERMISSIONS[user.role]` is used as the default. Schema default is `COACH` but the adapter overrides this at signup based on email domain (PARENT for non-staff, ADMIN for staff).
- **Superadmin re-elevation is sticky.** Cross-link § 0.3.
- **Avatar uploads are not resized.** Original file is stored; `avatarCrop` JSON (x/y/width/height as percentages) is applied at render time. Large originals will slow the avatar fetch.
- **Phone verification is per-User, not per-OrgMember.** Verifying once carries across orgs.
- **CUSTOM role with no permissions = effectively no access.** Routes will 403 because permission checks fail.
- **`*` wildcard permission** is functionally equivalent to `ADMIN` role for permission-gated routes — but role-gated UI elements may still hide for non-ADMIN users.
- **Self-deletion is blocked** ([api/users/[id]/route.ts:168-169](../src/app/api/users/[id]/route.ts#L168-L169)) — no risk of an admin orphaning their own org by deleting themselves.
- **No role upgrade on invite.** If you invite an existing PARENT user as ADMIN, a new `OrganizationMember` row is created with role=ADMIN; their existing membership in another org is unchanged. (Cross-link § 0.6.)

#### Known limitations / gaps

- **No email change.** End-users cannot change email; requires DB intervention.
- **No password change UI surface confirmed** for logged-in users in the athletes portal — possibly only via reset-password flow.
- **No GDPR / soft-delete.** Hard delete only, with cascade implications.
- **`User.role` vs `OrganizationMember.role`** — `OrganizationMember.role` wins when present; `User.role` is the fallback. Drift between the two is possible but resolved deterministically.
- **No audit log** of permission changes (who promoted whom, when).
- **Address field** not directly on `User` — TODO: confirm where billing/shipping address lives (`Guardian` model? `OrganizationMember`?).
- **Avatar resizing** would reduce storage and bandwidth; currently unbounded except by 5 MB upload limit.
- **CUSTOM role permission UI** — TODO: locate (likely under `/dashboard/organization/staff/[id]/edit` or similar).

#### Code references

- [prisma/schema.prisma:194-232](../prisma/schema.prisma#L194-L232) — `OrganizationMember`
- [prisma/schema.prisma:240-309](../prisma/schema.prisma#L240-L309) — `User`
- [prisma/schema.prisma:417-425](../prisma/schema.prisma#L417-L425) — `OrgMemberPermission`
- [prisma/schema.prisma:457-464](../prisma/schema.prisma#L457-L464) — `Role` enum
- [src/lib/permissions.ts:5-60](../src/lib/permissions.ts#L5-L60) — permission key catalog
- [src/lib/permissions.ts:327-348](../src/lib/permissions.ts#L327-L348) — permission helpers
- [src/types/next-auth.d.ts:9](../src/types/next-auth.d.ts#L9) — session shape declaration
- [src/app/api/users/route.ts:65-200](../src/app/api/users/route.ts#L65-L200) — invite + list
- [src/app/api/users/[id]/route.ts:63-184](../src/app/api/users/[id]/route.ts#L63-L184) — get/edit/delete
- [src/app/api/avatar/route.ts](../src/app/api/avatar/route.ts) — avatar upload
- [src/app/(auth)/switch-organization/page.tsx:70-87](<../src/app/(auth)/switch-organization/page.tsx#L70-L87>) — org switcher
- [src/app/athletes/account/page.tsx](../src/app/athletes/account/page.tsx) — self-service account
- [src/app/dashboard/organization/staff/page.tsx](../src/app/dashboard/organization/staff/page.tsx) — staff management UI

### 0.6 Invitations

**Status:** Live · **Plan gate:** Always on · **Portals:** `admin.` (send), `login.` (accept)
**Primary models:** `OrganizationInvitation`
**Owner / latest major work:** TODO

#### What it does

The mechanism by which an admin grants a user access to their organization. Two send paths exist (staff invites and guardian/parent invites), both producing single-use, 7-day tokens. The accept flow detects whether the invitee already has a `User` row and routes them to either set-password or auto-link.

#### Sub-features

- [x] Single `OrganizationInvitation` model with `PENDING | ACCEPTED | EXPIRED | CANCELLED` status
- [x] 7-day expiry from creation
- [x] UUID v4 token (`crypto.randomUUID()`)
- [x] Staff invite path (`POST /api/users`)
- [x] Guardian invite path (`POST /api/guardians/invite`)
- [x] New-user accept flow (set password, accept terms, auto-login)
- [x] Existing-user accept flow (auto-link, redirect to login)
- [x] Role assignment at invite (any of the 6 `Role` values)
- [x] CUSTOM-role permission assignment via `permissions[]` array
- [x] Email templates per flow (`invitation`, `invitation-existing-user`)
- [x] Status checks at GET + POST (single-use enforcement)
- [x] Auto-expire-on-reinvite (guardians path only)
- [x] Lazy expiry sweep on GET (route marks `EXPIRED` when accessed past `expiresAt`)
- [x] Bulk expiry sweep via `cleanup` cron
- [ ] **Cancellation endpoint** — NOT IMPLEMENTED
- [ ] **Resend endpoint** — NOT IMPLEMENTED (guardians has expire-on-reinvite workaround; staff doesn't)
- [ ] **Invitation listing dashboard** — NOT IMPLEMENTED (no UI shows pending/expired invites)
- [ ] **Bulk invite (CSV)** — NOT IMPLEMENTED
- [ ] **Role upgrade on existing PARENT being invited as ADMIN** — creates new membership row instead of upgrading

#### `OrganizationInvitation` model ([prisma/schema.prisma:428-448](../prisma/schema.prisma#L428-L448))

| Field                    | Type                           | Notes                                |
| ------------------------ | ------------------------------ | ------------------------------------ | -------- | ------- | ---------- |
| `id`                     | cuid                           |                                      |
| `email`                  | string                         | Recipient email                      |
| `token`                  | string (unique)                | UUID v4                              |
| `organizationId`         | string                         | FK                                   |
| `role`                   | Role enum                      | Target role on acceptance            |
| `status`                 | `OrganizationInvitationStatus` | `PENDING                             | ACCEPTED | EXPIRED | CANCELLED` |
| `invitedById`            | string                         | FK to inviting `User`                |
| `expiresAt`              | DateTime                       | `createdAt + 7 days`                 |
| `acceptedAt`             | DateTime?                      | Set on acceptance                    |
| `emailSentAt`            | DateTime?                      | Set when invitation email dispatched |
| `createdAt`, `updatedAt` | DateTime                       |                                      |

Status enum: [prisma/schema.prisma:450-455](../prisma/schema.prisma#L450-L455).

#### Token generation

- `crypto.randomUUID()` — UUID v4, 36-char string
- Sources: [src/app/api/users/route.ts:103](../src/app/api/users/route.ts#L103), [src/app/api/guardians/invite/route.ts:41](../src/app/api/guardians/invite/route.ts#L41)
- Note: not raw bytes; UUID format. Probability of collision is negligible but format is recognizable in URLs.

#### Expiry

- 7 days, set at creation: `new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)` ([api/users/route.ts:104](../src/app/api/users/route.ts#L104))
- **Two sweep mechanisms keep `status` in sync with `expiresAt`:**
  1. **Lazy sweep on GET** — `GET /api/invitations/[token]` updates the row to `status: "EXPIRED"` when accessed past `expiresAt` ([api/invitations/[token]/route.ts:77-82](../src/app/api/invitations/[token]/route.ts#L77-L82)).
  2. **Cron sweep** — the daily `cleanup` cron batch-updates expired `PENDING` rows to `EXPIRED` ([api/cron/cleanup/route.ts:44](../src/app/api/cron/cleanup/route.ts#L44)).

#### Send paths

**Staff invite — `POST /api/users`** ([route](../src/app/api/users/route.ts))

- Permission: `users.create` ([L74-76](../src/app/api/users/route.ts#L74-L76))
- Side effects (new user):
  - Create `User` (status=`INVITED`, no `passwordHash`)
  - Create `OrganizationMember` (status=`INVITED`, role=X)
  - If role=`CUSTOM`, create `OrgMemberPermission` rows for the supplied permission array
  - Create `OrganizationInvitation` (status=`PENDING`)
  - Dispatch email template `"invitation"`
- Side effects (existing user):
  - Create `OrganizationMember` only (User exists)
  - Create `OrganizationInvitation` (status=`PENDING`)
  - Dispatch email template `"invitation-existing-user"`

**Guardian invite — `POST /api/guardians/invite`** ([route](../src/app/api/guardians/invite/route.ts))

- Permission: `users.create` ([L23-26](../src/app/api/guardians/invite/route.ts#L23-L26))
- Re-invite handling: any existing `PENDING` invite for the same email is marked `EXPIRED` first ([L97-104](../src/app/api/guardians/invite/route.ts#L97-L104)). New invitation issued.

#### Email templates ([src/lib/email.ts:469-532](../src/lib/email.ts#L469-L532))

| Template                   | Subject                                                      | Body intent            |
| -------------------------- | ------------------------------------------------------------ | ---------------------- |
| `invitation` (new user)    | `"You've been invited to join {{organizationName}}"`         | "Set up your account"  |
| `invitation-existing-user` | `"{{inviterName}} invited you to join {{organizationName}}"` | "Just click to accept" |

Both note 7-day expiry and include the invite link as a button.

#### Accept flow

**Page:** [/accept-invitation?token=...](<../src/app/(auth)/accept-invitation/page.tsx>)

**GET `/api/invitations/[token]`** ([route:1-150](../src/app/api/invitations/[token]/route.ts#L1-L150))

- Looks up invitation by token
- Returns `EXPIRED` if `now > expiresAt`
- Returns `CANCELLED` if `status === CANCELLED`
- Returns `ACCEPTED` if already accepted ([L65-74](../src/app/api/invitations/[token]/route.ts#L65-L74))
- Otherwise returns invitation details for the page to render

**POST `/api/invitations/[token]`** ([route:168-291](../src/app/api/invitations/[token]/route.ts#L168-L291))

- Same pre-checks
- Detects user existence: `db.user.findUnique({ email: invitation.email })` ([L121-138](../src/app/api/invitations/[token]/route.ts#L121-L138))

**New user:**

- Password required (12-char policy enforced — § 0.3)
- bcrypt cost 12 ([src/lib/auth.ts:726](../src/lib/auth.ts#L726))
- Terms acceptance required (form check)
- Updates `User`: `passwordHash`, `status=ACTIVE`, `termsAcceptedAt=now`
- Updates `OrganizationMember`: `status=ACTIVE`
- Updates `OrganizationInvitation`: `status=ACCEPTED`, `acceptedAt=now`
- Auto-login via `signIn("credentials", ...)` → redirect to `/dashboard` ([accept-invitation/page.tsx:120](<../src/app/(auth)/accept-invitation/page.tsx#L120>))

**Existing user:**

- No password input shown (already has one)
- Updates `OrganizationMember`: `status=ACTIVE`
- Updates `OrganizationInvitation`: `status=ACCEPTED`, `acceptedAt=now`
- Redirect to `/login?email=...` so they can log in with their existing credentials ([accept-invitation/page.tsx:156](<../src/app/(auth)/accept-invitation/page.tsx#L156>))

#### User flows

**Admin invites a new coach (new user):**

1. Admin → `/dashboard/organization/staff` → "Invite".
2. POST `/api/users` with email/role.
3. Email sent. Coach clicks link → `/accept-invitation?token=...`
4. GET checks token → renders form (name, password, terms checkbox).
5. POST `/api/invitations/[token]` → updates rows, signs them in.
6. Redirect to `/dashboard`.

**Admin invites an existing parent as a coach in another org:**

1. POST `/api/users` finds existing User by email → creates `OrganizationMember` with role=`COACH` for new org.
2. Email sent (existing-user template).
3. User clicks link → GET shows "you've been added to {org}" page.
4. POST `/api/invitations/[token]` → activates membership.
5. Redirect to `/login?email=...` (they keep their existing password).

**Re-invite a guardian whose token expired:**

1. Admin re-issues from `/api/guardians/invite`.
2. Old `PENDING` invitation for same email → marked `EXPIRED` ([api/guardians/invite/route.ts:97-104](../src/app/api/guardians/invite/route.ts#L97-L104)).
3. New invitation issued with new token.
4. **Note:** the staff path (`/api/users`) has no equivalent "expire old" logic — TODO: confirm whether it allows duplicate pending invites to coexist.

#### Permissions & roles

- Send: `users.create` (or `*`).
- Cancel: TODO: no endpoint exists.
- View pending: TODO: no listing endpoint exists.

#### Data model

See above. No relation to `OrganizationMember` directly — membership rows are created at invite time and activated at accept time.

#### API routes

| Route                      | Method | Purpose                                             |
| -------------------------- | ------ | --------------------------------------------------- |
| `/api/users`               | POST   | Send staff invite (new + existing user)             |
| `/api/guardians/invite`    | POST   | Send guardian invite (with auto-expire-on-reinvite) |
| `/api/invitations/[token]` | GET    | Pre-flight check for accept page                    |
| `/api/invitations/[token]` | POST   | Accept invitation                                   |

#### Background jobs

- `cleanup` cron — batch-marks expired `PENDING` invitations as `EXPIRED` ([api/cron/cleanup/route.ts:44](../src/app/api/cron/cleanup/route.ts#L44)). Cross-link § 4.1.

#### External integrations

- Email service (SES / MailHog) for invitation emails.

#### Webhooks

None.

#### Notifications & emails

- `invitation` (new user)
- `invitation-existing-user`
- TODO: confirm whether a "you've been removed" email exists when an `OrganizationMember` is set to `INACTIVE`.

#### Configuration

None specific.

#### Lifecycle / state machines

```
            POST /api/users or
            POST /api/guardians/invite
                    │
                    v
                PENDING ──┬──> ACCEPTED  (POST /api/invitations/[token] success)
                          │
                          ├──> EXPIRED   (GET on stale token, OR re-invite via guardians path)
                          │
                          └──> CANCELLED (NO ENDPOINT — manual DB only)
```

#### Business rules & edge cases

- **The token is the credential — by design.** POST `/api/invitations/[token]` does not require a session and does not validate `session.user.email === invitation.email`. The user is looked up via `invitation.email`, and either gets a fresh password (new-user path) or has their `OrganizationMember` activated (existing-user path). The route comment ([line 302](../src/app/api/invitations/[token]/route.ts#L302)) is explicit: _"the token itself proves they have access to the invited email address, so no session/login is required."_ This is the same threat model as password-reset tokens — link possession = email control. **Defense-in-depth gap, not a vulnerability:** for the existing-user path, requiring `session.user.email === invitation.email` would prevent an attacker who finds the link from silently activating the membership without compromising email — but this is mitigated by the 7-day expiry and single-use enforcement.
- **Existing PARENT invited as ADMIN does not get role upgraded.** A new `OrganizationMember` row is created with role=`ADMIN` for the same User. Their existing PARENT membership in another org is unchanged — but if they're invited to the _same_ org they're already a PARENT in, behavior is TODO (likely creates a duplicate-key error or a second active membership).
- **Cancellation requires DB intervention.** If an admin invites the wrong person, there's no UI to revoke. Workaround: wait 7 days for expiry, or update the row directly.
- **Resend requires DB intervention** for the staff path. Re-issuing creates an additional `PENDING` row instead of refreshing the existing one. Guardians path has the auto-expire workaround.
- **No invitation listing UI.** Admins can't see who they've invited or which invites are still pending. Audit visibility is poor.
- **Email auto-verification.** Accepting an invite implicitly verifies the email (token possession = email control). No separate verification step.
- **Auto-login post-accept (new user) is performed via `signIn("credentials")`.** This means the new user's first request is on the `login.` subdomain context; they're redirected to `/dashboard` which usually lives on `admin.` — cross-subdomain handoff via the standard cookie-domain mechanism (§ 0.3).
- **`status` transitions are not symmetrical.** Once `ACCEPTED`, no path back to `PENDING`. `EXPIRED → ACCEPTED` is implicitly blocked by the GET pre-check.

#### Known limitations / gaps

- **Cancel endpoint missing** — admins can't revoke a sent invitation; must wait for 7-day expiry or update the row directly.
- **Resend endpoint missing** — staff invites can pile up duplicate `PENDING` rows for the same email. The guardians path expires the old row on re-invite as a workaround; the staff path does not.
- **Listing endpoint missing** — admins can't audit pending invites. The data is only accessible via DB.
- **Bulk CSV import missing.**
- **Email-mismatch defense-in-depth.** Adding `session.user.email === invitation.email` to the existing-user POST path would harden against link-leak attacks at the cost of a slightly worse UX (forces login before accept). Optional improvement, not a vulnerability.
- **Role upgrade ambiguity** — inviting an existing user to a role they already have, or to a higher role in the same org, is unspecified. Likely creates a unique-key conflict on `(orgId, userId)` — needs verification.

#### Code references

- [prisma/schema.prisma:428-455](../prisma/schema.prisma#L428-L455) — model + status enum
- [src/app/api/users/route.ts:65-200](../src/app/api/users/route.ts#L65-L200) — staff invite send
- [src/app/api/guardians/invite/route.ts:15-110](../src/app/api/guardians/invite/route.ts#L15-L110) — guardian invite send
- [src/app/api/invitations/[token]/route.ts:1-291](../src/app/api/invitations/[token]/route.ts#L1-L291) — GET + POST accept
- [src/app/(auth)/accept-invitation/page.tsx:1-516](<../src/app/(auth)/accept-invitation/page.tsx#L1-L516>) — accept UI
- [src/lib/email.ts:469-532](../src/lib/email.ts#L469-L532) — both email templates
- [docs/BUSINESS-RULES.md § Invitation Lifecycle](BUSINESS-RULES.md#invitation-lifecycle) — companion business rules

### 0.7 Public API & request resolution

**Status:** Live · **Plan gate:** Always on · **Portals:** all (consumed by tenant marketing sites + checkout flows)
**Primary models:** `WebsiteConfig`, `Organization`
**Owner / latest major work:** TODO

#### What it does

Provides unauthenticated API surfaces under `/api/public/*` that resolve the target organization from the request's Host header (subdomain) instead of a session. Used by tenant marketing sites for browsing programs/memberships/passes, by guest checkout flows, and by waiver-signing pages. Rate-limited and bypasses session-based middleware checks. **Does not** apply `getScopedDb` — public routes use raw `db` with manual `where: { organizationId }` filters.

#### Sub-features

- [x] `resolvePublicRequest()` extracts org from Host header
- [x] `parseSlugFromHost()` strips base domain to derive subdomain slug
- [x] System-subdomain blocklist (admin, login, www, etc.)
- [x] Org lookup via `WebsiteConfig.subdomain` unique field
- [x] Rate limiting (20 req/sec prod, 50 req/sec dev) per public prefix
- [x] Auth bypass at middleware level for `/api/public/*`
- [x] Public route inventory across athletes, memberships, passes, programs, waivers, products, etc.
- [x] Site-config endpoint for tenant marketing site SSR
- [x] Inactive-org rendering check at site layout (`SiteUnavailablePage`)
- [ ] **Custom domain support** — `WebsiteConfig.domain` exists in schema but is NOT integrated into `parseSlugFromHost`. Custom domains do not currently route through `resolvePublicRequest`.
- [ ] **CSRF protection** on public POST routes — not enforced
- [ ] **`isActive` check on public routes** — not enforced (only the SSR site layout checks it, not the API)
- [ ] **DB-backed reserved-domain check at resolve time** — only the hardcoded SYSTEM_SUBDOMAINS set is consulted; the `ReservedDomain` table is only checked at signup

#### `resolvePublicRequest` ([src/lib/public-api.ts:121-135](../src/lib/public-api.ts#L121-L135))

Step-by-step:

1. Apply rate limit: `checkApiRateLimit(request, "public")` → returns 429 if exceeded.
2. Call `resolvePublicOrganizationId(request)`:
   - `parseSlugFromHost(request.headers.get("host"))` to extract subdomain.
   - Query `db.websiteConfig.findUnique({ where: { subdomain }, select: { organizationId } })` ([L84-86](../src/lib/public-api.ts#L84-L86)).
3. On success: return `{ organizationId: string }`.
4. On failure: return `NextResponse.json({ error }, { status })` — 400 (malformed Host), 403 (system subdomain), or 404 (unknown subdomain).

#### `parseSlugFromHost` ([src/lib/public-api.ts:24-59](../src/lib/public-api.ts#L24-L59))

Strips base domain (`uplifter.app`, `upliftergymnastics.com`, etc.) or `.localhost:3000` suffix; returns the remaining subdomain or `null`.

Returns null for:

- Bare domain (no subdomain)
- `www.` prefix
- Any subdomain in `SYSTEM_SUBDOMAINS` ([L6-18](../src/lib/public-api.ts#L6-L18)): `admin, login, superadmin, coach, athletes, pos, feedback, events, startup, www, main`

**Custom domains are NOT handled.** A request to a tenant's custom domain (`mygym.com`) won't match `parseSlugFromHost` because it doesn't end in a known base domain. The function returns null. Custom domain support is a TODO — the `customDomains` feature toggle exists but the resolver doesn't integrate.

#### Org lookup

- Query: `db.websiteConfig.findUnique({ where: { subdomain: slug } })` ([L84-86](../src/lib/public-api.ts#L84-L86)).
- **Indexed via `WebsiteConfig.subdomain` unique constraint** ([prisma/schema.prisma:2854](../prisma/schema.prisma#L2854)).
- The `Organization.slug` field exists but is NOT used here — `WebsiteConfig.subdomain` is canonical for routing.
- **No `isActive` check** at this layer.

#### Auth bypass at middleware

[src/middleware.ts:132-141](../src/middleware.ts#L132-L141) explicitly bypasses `/api/auth` and `/api/webhooks/` (and by extension `/api/public/`) — those routes are NOT rewritten to a portal namespace and are not session-gated.

Auth is checked **inside** the public route only when needed. Example: `/api/public/waivers/[id]/sign` calls `getAuthSession()` ([waiver-sign/route.ts:27-29](../src/app/api/public/waivers/[id]/sign/route.ts#L27-L29)) because signing requires identity.

#### Tenant scoping after resolution

Public routes use **raw `db`** with manual `where: { organizationId }` filters, NOT `getScopedDb`.

Representative example: [src/app/api/public/products/route.ts:19-67](../src/app/api/public/products/route.ts#L19-L67) — `db.product.findMany({ where: { organizationId, isActive: true } })`.

Why not `getScopedDb`? `getScopedDb` is built for trusted-session contexts where `session.user.organizationId` is the source of org-id. Public routes derive org-id from Host, so they bypass the helper and inline the filter. **Drift risk:** the manual filter pattern is easy to miss on new routes — there is no static check enforcing it.

#### Public routes inventory

| Route                                       | Purpose                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/api/public/site-config`                   | Site config (tax rate, fees) by slug — used by SSR sites                                                 |
| `/api/public/categories`                    | Product categories                                                                                       |
| `/api/public/products/[id]`                 | Product details                                                                                          |
| `/api/public/passes`                        | Pass listing                                                                                             |
| `/api/public/memberships`                   | Membership group listing + eligibility checks                                                            |
| `/api/public/medical-config`                | Medical form configuration                                                                               |
| `/api/public/custom-information/*`          | Custom field schema get/upload                                                                           |
| `/api/public/waivers/[id]/*`                | Waiver retrieval & signing (sign requires auth)                                                          |
| `/api/public/calendar/instances`            | Calendar event instances                                                                                 |
| `/api/public/programs/registrations`        | Check athlete enrollment status                                                                          |
| `/api/public/programs/waiver-requirements`  | Waivers required per program                                                                             |
| `/api/public/programs/medical-requirements` | Medical info required per program                                                                        |
| `/api/public/registration-files/check`      | Validate uploaded registration files                                                                     |
| `/api/public/athletes/[id]/*`               | Athlete profile + medical/membership/custom-info (parent-self-service via session, athlete-id from path) |

#### Rate limiting

- Limits live in [src/lib/rate-limit.ts:33-48](../src/lib/rate-limit.ts#L33-L48).
- Public prefix: `{ limit: isDev ? 50 : 20, windowSeconds: 1 }`.
- Implementation: Redis sliding window keyed by client IP (X-Forwarded-For / X-Real-IP / Cloudflare headers).
- Failure mode: dev fails closed if Redis unavailable; prod is permissive (continues without rate limit).

#### CSRF

- **Not enforced** on public POST routes.
- Middleware adds CORS headers ([middleware.ts:13-46](../src/middleware.ts#L13-L46)) but does not check CSRF tokens.
- Mitigation in practice: most public POSTs require an authenticated session anyway (waiver sign, registration finalization), and checkout uses Adyen sessions which have their own session token mechanism.

#### Public registration & guest checkout

**Not via `/api/public/*` directly** — instead, the checkout flow lives at `/api/sites/[slug]/checkout/session` ([route](../src/app/api/sites/[slug]/checkout/session/route.ts)).

Sequence (rough):

1. Visitor browses tenant marketing site → builds cart.
2. POST to `/api/sites/[slug]/checkout/session` with cart (programs / memberships / passes / products) and parent contact info.
3. Server creates Adyen Session (cross-link § 1.20-ish).
4. Frontend renders Adyen drop-in.
5. Adyen webhook → server provisions Guardian / Athlete / Enrollment rows post-payment via `resolveOrProvisionCheckoutUser()`.

So guest checkout **does** create accounts on the fly, but the entry point is `/api/sites/[slug]/...`, not `/api/public/...`. This is a naming inconsistency worth noting.

#### Public site rendering vs public API

Both keyed on `WebsiteConfig.subdomain`, but via different paths:

- **SSR sites:** `getCachedSiteConfig(subdomain)` in [src/app/sites/[slug]/layout.tsx:30-39](../src/app/sites/[slug]/layout.tsx#L30-L39) → `db.websiteConfig.findUnique({ where: { subdomain } })`.
- **Public API:** `resolvePublicRequest()` → same query.

The SSR layout DOES check `isActive` ([sites/[slug]/layout.tsx:238](../src/app/sites/[slug]/layout.tsx#L238)) and renders `<SiteUnavailablePage />` for inactive orgs. The public API does **not** check `isActive`.

#### Permissions & roles

N/A — public.

#### Data model

None directly. Reads from `WebsiteConfig` and `Organization`.

#### API routes

See inventory above plus the resolver itself in `src/lib/public-api.ts`.

#### Background jobs

None.

#### External integrations

- Redis (rate limiting).

#### Webhooks

None inbound. (Public routes are typically the targets of public clicks, not webhooks.)

#### Notifications & emails

None.

#### Configuration

| Env var           | Purpose                            |
| ----------------- | ---------------------------------- |
| `UPSTASH_REDIS_*` | Required for rate limiting in prod |

#### Lifecycle / state machines

N/A.

#### Business rules & edge cases

- **Custom domains break public API.** A tenant who configures a custom domain (gated feature § 2.5) gets a working SSR site but their `/api/public/*` calls from that domain will 400/404 because `parseSlugFromHost` doesn't recognize the host. Cross-link to § 2.5 — this needs fixing if custom domains are to be production-ready.
- **Inactive orgs still serve public API.** SSR layout shows the unavailable page, but a direct call to `/api/public/products` for an inactive org would return data. If you scrape data, deactivation doesn't stop you. Mitigation: add `isActive` check inside `resolvePublicRequest`.
- **Reserved subdomains aren't checked at resolve time.** SYSTEM_SUBDOMAINS is hardcoded but doesn't read from `ReservedDomain` table. If a new reserved word is added (e.g. `analytics`) but a tenant already claimed it, resolution silently routes to that tenant.
- **Raw-`db` usage by design.** Public routes intentionally bypass `getScopedDb` because the org-id source is Host-derived, not session-derived. Each route author is responsible for the org filter. There is no static check.
- **`/api/sites/[slug]/*` exists alongside `/api/public/*`.** The split is historical: `/api/public/` is for clean GETs across orgs; `/api/sites/[slug]/` includes the slug in the path explicitly. Both are valid public-API patterns. Consider consolidating.
- **`SiteUnavailablePage` is rendered for inactive orgs at the SSR layer**, which means the page bundle for an inactive org's site loads (with the unavailable message). The public API tier doesn't have an equivalent.

#### Known limitations / gaps

- **Custom domain support requires changes to `parseSlugFromHost`** — likely a `db.websiteConfig.findFirst({ where: { domain: host } })` fallback before the subdomain stripping.
- **No `isActive` enforcement** at the API layer.
- **No CSRF protection** — relies on session-bound checks on writes that need it.
- **Path inconsistency** between `/api/public/*` and `/api/sites/[slug]/*` for similar-purpose endpoints.
- **No allowlist/blocklist** for which models can be exposed via public endpoints — discipline only.
- **Rate-limit failure mode differs prod vs dev** — confusing during incident response.

#### Code references

- [src/lib/public-api.ts:1-150](../src/lib/public-api.ts) — full module
- [src/lib/public-api.ts:6-18](../src/lib/public-api.ts#L6-L18) — `SYSTEM_SUBDOMAINS`
- [src/lib/public-api.ts:24-59](../src/lib/public-api.ts#L24-L59) — `parseSlugFromHost`
- [src/lib/public-api.ts:84-86](../src/lib/public-api.ts#L84-L86) — `WebsiteConfig` lookup
- [src/lib/public-api.ts:121-135](../src/lib/public-api.ts#L121-L135) — `resolvePublicRequest`
- [src/middleware.ts:132-141](../src/middleware.ts#L132-L141) — auth bypass for public routes
- [src/lib/rate-limit.ts:33-48](../src/lib/rate-limit.ts#L33-L48) — public rate limit config
- [src/app/sites/[slug]/layout.tsx:30-39,238](../src/app/sites/[slug]/layout.tsx#L30-L39) — SSR site config + isActive check
- [src/app/api/public/products/route.ts:19-67](../src/app/api/public/products/route.ts#L19-L67) — representative public route
- [prisma/schema.prisma:2854](../prisma/schema.prisma#L2854) — `WebsiteConfig.subdomain` unique constraint

---

# Part 1 — Core domain (always-on)

> Available on every plan. Feature gates do not apply.

### 1.1 Athletes

**Sub-features:** profile (name/DOB/gender), medical info (cross-org shared), `OrganizationAthlete` join, athlete portal access, photo upload, custom info responses (when `customInformation` enabled).

### 1.2 Guardians & guardian claims

**Sub-features:** primary/secondary, `AthleteGuardian` join, multi-family `GuardianClaimRequest` flow, invitation to athlete portal.

### 1.3 Programs (recurrence, pricing, restrictions)

**Sub-features:** RFC 5545 `rrule`, generated `ProgramInstance`s, pricing tiers, gender/age/level restrictions, program-level vs per-instance registration types, capacity, registration windows, early-access codes, program archival.

### 1.4 Calendar

**Sub-features:** admin calendar view, coach view, athlete schedule view, drag-and-drop (TODO: confirm), `useCalendarStore` (Zustand).

### 1.5 Registration & enrollment

**Sub-features:** program-level enrollment, per-session `InstanceRegistration`, registration queue (`/api/queue/`), reservation expiry (cron: `expire-reservations`), eligibility checks (membership, age, level, gender), capacity enforcement.

### 1.6 Attendance

**Sub-features:** `Attendance`, `InstanceAttendance`, attendance via coach portal, attendance via events portal QR, missed-attendance notification (`ATTENDANCE_MISSED`).

### 1.7 Discounts

**Sub-features:** percentage / fixed amount, scoping (user, product type), code redemption, expiry, usage limits.

### 1.8 Invoices & line items

**Sub-features:** `Invoice`, `LineItem` polymorphic links to programs/events/memberships/passes/products, subtotal/tax/processing-fee breakdown, status transitions, customer-facing invoice PDFs (TODO: confirm).

### 1.9 Payments & transactions

**Sub-features:** Adyen Sessions API integration, `Payment`/`Transaction` records, payment status webhook updates, manual payment recording, partial payments (TODO: confirm).

### 1.10 Refunds

**Sub-features:** full / partial refunds, Adyen refund API, refund webhook, ledger reversal.

### 1.11 Recurring charges (end-user)

**Sub-features:** auto-billing for memberships/passes/enrollments, `RecurringCharge` model, daily cron (`recurring-billing`), 20-hr min retry interval, max 3 retries, idempotent reference, pre-charge reminders (3 days), auto-termination on linked entity cancellation.
Cross-link: `BUSINESS-RULES.md § Recurring Billing`.

### 1.12 Stored payment methods

**Sub-features:** Adyen tokenization per `Guardian`, default-method selection, expiry tracking, `payment-method-check` cron.

### 1.13 Processing fees & tax

**Sub-features:** org-pays-fees rule, fee formula, tax-paid-by setting (CUSTOMER vs ORGANIZATION).
Cross-link: `BUSINESS-RULES.md § Processing Fees`.

### 1.14 GL codes & ledger

**Sub-features:** chart of accounts (`GLCode`), `LedgerEntry` per transaction, GL code mapping per line-item type.

### 1.15 Adyen Balance Platform (payouts)

**Sub-features:** Legal Entity / Account Holder / Balance Account creation, daily sweep, `Payout` records, payout webhook tracking, bank-account verification, payout schedule per org.
Cross-link: [docs/adyen-platform/](adyen-platform/).

### 1.16 Notification rules (trigger engine)

**Sub-features:** 22 trigger types, per-rule template, `process-notifications` cron (5-min cadence), `NotificationDeduplication`, `NotificationLog` audit trail. Note: some triggers reference gated features (e.g. membership) but the engine itself is core.

### 1.17 Conversations (1:1 chat)

**Sub-features:** SMS-backed conversations, web chat, inbound SMS routing via Twilio webhook, per-org thread separation, attachment support (TODO: confirm).

### 1.18 Announcements (org-scoped)

**Sub-features:** create / publish / archive, read receipts, scheduled publish, scoped audiences (TODO: confirm).

### 1.19 Email service (transactional)

**Sub-features:** SES (cloud) / MailHog (local), 1,300+ line `lib/email.ts` with templates, bounce/complaint webhooks via SNS, sandbox vs production mode per env.

### 1.20 SMS service (transactional + consent)

**Sub-features:** Twilio integration, `SMS_PHONE_POOL` env var, `SmsNumberAssignment` per org, opt-in/opt-out flow, TCPA consent fields on `User` (5 fields + opt-out pair), `sendSingleSms` enforcement gate, `Message` audit row, inbound webhook routing.

### 1.21 Waivers

**Sub-features:** multi-page waiver, per-page digital signature (base64 PNG), `WaiverAcceptance` completion record, waiver versioning (TODO: confirm), waiver re-sign on update.

### 1.22 Facilities, spaces, equipment

**Sub-features:** physical location with hours/capacity, rooms within facilities, equipment with condition tracking, `FacilityAssignment` for staff.

### 1.23 Public marketing sites (website builder)

**Sub-features:** per-org subdomain, theme/branding, content blocks, navigation builder, page editor, public-facing programs/events/competitions surfaces, SEO metadata.
Cross-link: [WEBSITE_BUILDER_README.md](../WEBSITE_BUILDER_README.md).

### 1.24 Bulk upload

**Sub-features:** CSV import for athletes/guardians (TODO: confirm scope), template download, validation errors UI.

### 1.25 File storage (S3 / MinIO)

**Sub-features:** S3 abstraction (`lib/storage.ts`), MinIO local mirror, CDN per env, signed URLs, attachment uploads (avatars, waivers, products).
Cross-link: [storage.md](../storage.md).

### 1.26 Action items / tasks dashboard

**Sub-features:** TODO — verify what `src/app/dashboard/action-items/` covers.

### 1.27 Forms (custom intake)

**Sub-features:** TODO — verify whether `src/app/dashboard/forms/` is core or gated under `customInformation`.

---

# Part 2 — Plan-gated features

> One section per key in [src/lib/feature-toggles.ts](../src/lib/feature-toggles.ts), in source-file order. Each gate disables: sidebar nav, API routes (via `requireFeature` guard), and where applicable storefront surfaces.

### 2.1 `events`

**Plan gate:** [`events`](../src/lib/feature-toggles.ts#L10) · **Portals:** admin, events, athletes, sites
**Sub-features:**

- [ ] Standalone `Event` model (separate from program instances)
- [ ] Event registration & capacity
- [ ] Event check-in (events portal, QR scan)
- [ ] Event staff assignments (`EventStaff`)
- [ ] Event reminders (`EVENT_REMINDER` notification)
- [ ] Event registration window notifications (`EVENT_REGISTRATION_OPEN/CLOSE`)
- [ ] Event listing on public marketing site
- [ ] Events portal: athlete search, schedule, day-of operations

TODO: full template.

### 2.2 `competitions`

**Plan gate:** [`competitions`](../src/lib/feature-toggles.ts#L11) · **Portals:** admin, athletes, sites, competitions (planned), results (planned)
**Sub-features:**

- [ ] Sport / SportEvent / SportAgeCategory taxonomy
- [ ] Eligibility matrix (`SportEventEligibility`)
- [ ] `Competition` with pricing & restrictions
- [ ] `CompetitionCategory` (event × age combos)
- [ ] `CompetitionEntry` with seed mark
- [ ] `CompetitionResult` (placement, heat, DNF/DNS/DQ, PB)
- [ ] `CompetitionTeam` (relays / team groupings)
- [ ] Bulk-scale registration handling
- [ ] Public competition browsing site (planned)
- [ ] Public results site (planned)

TODO: full template.

### 2.3 `sms`

**Plan gate:** [`sms`](../src/lib/feature-toggles.ts#L12) · **Portals:** admin, athletes
**Sub-features:**

- [ ] SMS campaigns (`SmsCampaign`) — bulk send with audience filtering
- [ ] Campaign scheduling (`sms-campaigns` cron)
- [ ] Per-org Twilio number assignment
- [ ] Inbound replies → conversations
- [ ] SMS usage dashboard (`src/app/dashboard/usage/`)
- [ ] TFV (Toll-Free Verification) submission flow
- [ ] Opt-in / opt-out (TCPA compliance) — note: consent infra is core (1.20), but campaign sending is gated

TODO: full template. Cross-link to [docs/sms-toll-free-verification.md](sms-toll-free-verification.md).

### 2.4 `emailCampaigns`

**Plan gate:** [`emailCampaigns`](../src/lib/feature-toggles.ts#L13) · **Portals:** admin
**Sub-features:**

- [ ] `EmailCampaign` & `EmailMessage` models
- [ ] Audience filtering / segmentation
- [ ] Open / click tracking
- [ ] Template editor (TODO: confirm)
- [ ] Scheduled sends
- [ ] Bounce / complaint handling

TODO: full template.

### 2.5 `customDomains`

**Plan gate:** [`customDomains`](../src/lib/feature-toggles.ts#L14) · **Portals:** admin (website settings), sites
**Sub-features:**

- [ ] Custom domain CNAME setup
- [ ] DNS verification
- [ ] TLS provisioning (TODO: confirm — ACM? Caddy?)
- [ ] Routing layer rewriting

TODO: full template.

### 2.6 `accountingIntegrations`

**Plan gate:** [`accountingIntegrations`](../src/lib/feature-toggles.ts#L15) · **Portals:** admin
**Sub-features:**

- [ ] QuickBooks Online OAuth + sync
- [ ] Xero OAuth + sync
- [ ] Account mapping UI (`AccountingAccountMapping`)
- [ ] Sync queue (`AccountingSyncQueue`)
- [ ] `accounting-sync` cron (15-min cadence)
- [ ] Sync log audit trail (`AccountingSyncLog`)
- [ ] Token encryption at rest

TODO: full template.

### 2.7 `training`

**Plan gate:** [`training`](../src/lib/feature-toggles.ts#L16) · **Portals:** admin, coach, athletes
**Sub-features:**

- [ ] Levels (`Level`)
- [ ] Skills (`Skill`) per level
- [ ] Evaluation templates (reusable blueprints)
- [ ] Per-athlete `Evaluation` instances
- [ ] `EvaluationSkill` ratings
- [ ] `AthleteSkillProgress` aggregation (attempts, best result)
- [ ] Achievements / badges (`Achievement`, `AthleteAchievement`)
- [ ] Skill-achieved notifications (`SKILL_ACHIEVED`)
- [ ] Evaluation-due / completed notifications
- [ ] Lesson planning (`useLessonPlanStore`)
- [ ] Coach portal evaluation entry

TODO: full template.

### 2.8 `store`

**Plan gate:** [`store`](../src/lib/feature-toggles.ts#L17) · **Portals:** admin, pos, sites
**Sub-features:**

- [ ] Product catalog
- [ ] Variants (color/size) with per-variant inventory
- [ ] Stock movements log
- [ ] Online storefront (per tenant marketing site)
- [ ] POS terminal portal
- [ ] Cash / card / split tender (TODO: confirm)
- [ ] Order history
- [ ] Receipt printing (TODO: confirm)
- [ ] Refunds via POS
- [ ] Inventory low-stock alerts (TODO: confirm)

TODO: full template.

### 2.9 `memberships`

**Plan gate:** [`memberships`](../src/lib/feature-toggles.ts#L18) · **Portals:** admin, athletes, sites
**Sub-features:**

- [ ] `MembershipGroup` (type definition with restrictions)
- [ ] `MembershipInstance` (specific period, e.g. "2025 Annual")
- [ ] `AthleteMembership` (purchased instance)
- [ ] Eligibility: gender / age / level / purchase window
- [ ] Storefront purchase flow
- [ ] Auto-renewal (links to recurring charges)
- [ ] Membership renewal cron
- [ ] Expiry / expired notifications
- [ ] Required-by-program enforcement (cross-feature)

TODO: full template.

### 2.10 `waitlists`

**Plan gate:** [`waitlists`](../src/lib/feature-toggles.ts#L19) · **Portals:** admin, athletes, sites
**Sub-features:**

- [ ] Per-program waitlist
- [ ] Per-instance waitlist
- [ ] Automatic promotion when capacity opens
- [ ] Waitlist-opening notification (`WAITLIST_OPENING`)
- [ ] Manual promotion / removal admin actions
- [ ] Waitlist position display

TODO: full template.

### 2.11 `passes`

**Plan gate:** [`passes`](../src/lib/feature-toggles.ts#L20) · **Portals:** admin, athletes, sites
**Sub-features:**

- [ ] `Pass` definition (session count, validity, covered programs)
- [ ] `AthletePass` purchases
- [ ] Auto-renew option
- [ ] Pass renewal cron
- [ ] Storefront purchase flow
- [ ] Session credit decrement on registration
- [ ] Pass expiry handling

TODO: full template.

### 2.12 `seasons`

**Plan gate:** [`seasons`](../src/lib/feature-toggles.ts#L21) · **Portals:** admin
**Sub-features:**

- [ ] Season definition (date range, label)
- [ ] Linked entities: programs, memberships, competitions
- [ ] Season transition cron (`seasons`)
- [ ] Season filtering UI
- [ ] Holiday closures within seasons (TODO: confirm relationship to `holiday-*` crons)

TODO: full template.

### 2.13 `liveSupport`

**Plan gate:** [`liveSupport`](../src/lib/feature-toggles.ts#L22) · **Portals:** admin (chat widget)
**Sub-features:**

- [ ] Zendesk live chat widget embed
- [ ] Per-org enable/disable
- [ ] User context handoff (TODO: confirm what user data is sent)

TODO: full template.

### 2.14 `customInformation`

**Plan gate:** [`customInformation`](../src/lib/feature-toggles.ts#L23) · **Portals:** admin, sites
**Sub-features:**

- [ ] Question definitions (per org)
- [ ] Question types: text, multi-choice, etc. (TODO: enumerate)
- [ ] Per-registration response capture
- [ ] Response surfacing in admin / coach views
- [ ] Required vs optional questions

TODO: full template.

### 2.15 `analytics`

**Plan gate:** [`analytics`](../src/lib/feature-toggles.ts#L24) · **Portals:** admin
**Sub-features:**

- [ ] Org-wide dashboard
- [ ] Athlete demographics
- [ ] Enrollment trends
- [ ] Program insights
- [ ] Visitor analytics (Upstash Redis backed)
- [ ] Date-range filtering

TODO: full template.

### 2.16 `reports`

**Plan gate:** [`reports`](../src/lib/feature-toggles.ts#L25) · **Portals:** admin
**Sub-features:**

- [ ] Revenue report
- [ ] Enrollment report
- [ ] Retention report
- [ ] Attendance report
- [ ] Financial summaries
- [ ] CSV / PDF export (TODO: confirm)
- [ ] Scheduled report delivery (TODO: confirm)

TODO: full template.

---

# Part 3 — Platform admin (superadmin)

> Only Uplifter staff. Mostly cross-tenant operations.

### 3.1 Subscription plans (`SubscriptionPlan`)

**Sub-features:** plan tiers (TODO: enumerate), pricing (monthly/yearly), feature toggle defaults, transaction-fee config, perTransaction-fee config, plan archival.

### 3.2 Organization subscriptions

**Sub-features:** plan assignment, billing cursor (`nextBillingDate`), Adyen recurring detail, status (TRIALING/ACTIVE/PAST_DUE/PAUSED), grace period.
Cross-link: `BUSINESS-RULES.md § Subscription Billing Lifecycle`.

### 3.3 Subscription invoicing & dunning

**Sub-features:** monthly invoice generation (`subscription-billing`), payment retry order, expired-card skip, atomic claim via `updateMany`, dunning warnings (30d/7d/1d), auto-deactivation, reactivation on payment.

### 3.4 Per-org feature overrides (`OrganizationFeatureOverride`)

**Sub-features:** superadmin toggle UI, override > plan default precedence, audit (TODO: confirm).

### 3.5 Adyen Balance Platform onboarding (KYC)

**Sub-features:** hosted onboarding link, KYC status tracking, admin kill-switch (`accountStatus`), payout schedule control.

### 3.6 Organization status logs

**Sub-features:** lifecycle event audit, who-did-what tracking, system vs user actor.

### 3.7 Referrals

**Sub-features:** referral code per org, signup attribution, credit-month accrual, draw-down against subscription invoices.

### 3.8 Platform announcements (`SystemAnnouncement`)

**Sub-features:** TODO — system-wide banner / toast pushed to all tenants.

### 3.9 SMS phone number pool

**Sub-features:** `SMS_PHONE_POOL` env, assignment to orgs, reassignment, exhaustion alerting (TODO: confirm).

### 3.10 Twilio TFV (Toll-Free Verification)

**Sub-features:** submission per business phone number, status tracking, resubmission flow.
Cross-link: [docs/sms-toll-free-verification.md](sms-toll-free-verification.md).

### 3.11 Reserved subdomains & profanity filter

**Sub-features:** reserved word list, `bad-words` library check, character validation, uniqueness enforcement.

### 3.12 Feedback portal

**Sub-features:** feature requests, roadmap, voting (TODO: confirm), public vs internal.

### 3.13 Superadmin user management

**Sub-features:** TODO — superadmin role assignment, Uplifter-staff auto-promotion on first login.

---

# Part 4 — Cross-cutting concerns

> Registries that span multiple features. These are not "features" in the user sense but warrant cataloging.

### 4.1 Cron job registry

**Status:** Live · **Source:** `vercel.json` + `src/app/api/cron/*`

- [ ] `expire-reservations` — every minute
- [ ] `process-notifications` — every 5 min
- [ ] `accounting-sync` — every 15 min
- [ ] `sms-campaigns` — every minute
- [ ] `recurring-billing` — daily 8am
- [ ] `membership-renewal` — daily 6am
- [ ] `pass-renewal` — daily 6am
- [ ] `subscription-dunning` — daily 12pm
- [ ] `subscription-billing` — 1st of month 12pm
- [ ] `holiday-announcements` — daily 8am
- [ ] `holiday-reminders` — daily 12pm
- [ ] `seasons` — daily 5am
- [ ] `cleanup` — Sundays 3am
- [ ] `payment-method-check` — Mondays 2pm

For each: schedule, purpose, dry-run support, idempotency guarantees, side effects, expected runtime.

### 4.2 Webhook registry

- [ ] Adyen payment webhook (`/api/webhooks/adyen`) — HMAC verified
- [ ] Adyen platform webhook (KYC, payouts) — TODO confirm endpoint
- [ ] Twilio inbound SMS (`/api/webhooks/twilio`)
- [ ] SES bounce/complaint via SNS (`/api/webhooks/ses`)
- [ ] QBO webhook (TODO: confirm)
- [ ] Xero webhook (TODO: confirm)

For each: signature verification, idempotency key, retry behavior, replay handling.

### 4.3 External integration registry

| Service                | Purpose                   | Key files                              | Notes                   |
| ---------------------- | ------------------------- | -------------------------------------- | ----------------------- |
| Adyen Sessions         | Direct payments           | `lib/adyen.ts`                         | TEST vs LIVE per env    |
| Adyen Balance Platform | Onboarding + payouts      | `lib/adyen-platform.ts`                | Marketplace model       |
| Twilio                 | SMS + voice (TODO)        | `lib/twilio.ts`, `lib/sms-service.ts`  | Pool routing            |
| AWS SES                | Email                     | `lib/email.ts`                         | Sandbox in non-prod     |
| AWS S3 / MinIO         | Storage                   | `lib/storage.ts`                       | CDN'd in prod           |
| Upstash Redis          | Cache + visitor analytics | `lib/redis.ts`                         |                         |
| QuickBooks Online      | Accounting sync           | `lib/qbo.ts`                           | OAuth, encrypted tokens |
| Xero                   | Accounting sync           | `lib/xero.ts`                          | OAuth, encrypted tokens |
| Google OAuth           | Social login              | `lib/auth.ts`                          |                         |
| Microsoft Entra        | SSO                       | `lib/auth.ts`                          |                         |
| Sentry                 | Error tracking            | `sentry.*.config.ts`                   | Client + server + edge  |
| Stadia Maps            | Facility maps             | env: `NEXT_PUBLIC_STADIA_MAPS_API_KEY` |                         |
| Zendesk                | Live chat                 | gated by `liveSupport`                 |                         |

For each: environment variables, failure modes, rate limits, cost model.

### 4.4 Notification trigger registry (22 triggers)

- [ ] `MEMBERSHIP_EXPIRY`
- [ ] `MEMBERSHIP_EXPIRED`
- [ ] `PAYMENT_DUE`
- [ ] `PAYMENT_OVERDUE`
- [ ] `PAYMENT_RECEIVED`
- [ ] `PROGRAM_REMINDER`
- [ ] `PROGRAM_ENROLLMENT`
- [ ] `PROGRAM_CANCELLATION`
- [ ] `EVENT_REMINDER`
- [ ] `EVENT_REGISTRATION_OPEN`
- [ ] `EVENT_REGISTRATION_CLOSE`
- [ ] `ATTENDANCE_MISSED`
- [ ] `SKILL_ACHIEVED`
- [ ] `EVALUATION_DUE`
- [ ] `EVALUATION_COMPLETED`
- [ ] `BIRTHDAY`
- [ ] `WAITLIST_OPENING`
- [ ] `RECURRING_CHARGE_*` (TODO: enumerate variants)
- [ ] `CUSTOM`

For each: trigger condition, dedup key, message scope (athlete/guardian/staff), default channel.

### 4.5 Feature toggle enforcement

**Sub-features:** plan defaults (`SubscriptionPlan.featureToggles`), per-org overrides (`OrganizationFeatureOverride`), runtime resolution (`feature-toggles.ts`), `requireFeature()` API guard, sidebar nav stripping (`FEATURE_SIDEBAR_MAP`), legacy key remapping (`LEGACY_KEY_MAP`).

### 4.6 Date handling

Cross-link: [docs/DATE-HANDLING.md](DATE-HANDLING.md). `parseDateOnly()` pattern, timezone-safe display.

### 4.7 Address & location data

**Sub-features:** `COUNTRIES` const, `getRegionsForCountry()`, ISO state codes (post-`migrate-states.ts`), country/state cascade.

### 4.8 Phone numbers

**Sub-features:** `PhoneInput` component, E.164 storage, `isValidPhoneNumber` validation.

### 4.9 Security headers & CSP

**Sub-features:** env-aware CSP, X-Frame-Options DENY, nosniff, HSTS in cloud, noindex in non-prod.

### 4.10 Secrets management (SOPS + age)

**Sub-features:** `.env.enc` source of truth, per-developer age public key, encrypt/decrypt/edit scripts, `.sops.yaml` recipient list.

### 4.11 Logging & observability

**Sub-features:** Sentry (client/server/edge), structured logger (`lib/logger.ts`), Groundcover (TODO: confirm scope).

### 4.12 Schema & migrations

**Sub-features:** `prisma migrate dev/deploy`, drift detection (`pnpm db:check`), pre-commit drift hook, enum-add-value pitfall.
Cross-link: README § Schema Management.

### 4.13 CI / CD

**Sub-features:** Docker multi-stage build, ECS Fargate (current), EKS + ArgoCD (target), per-env Terraform stacks, GitHub Actions image push.

### 4.14 Dev tooling

**Sub-features:** local docker-compose stack, local subdomain hosts file, OAuth localhost workaround, MailHog email viewer, MinIO console, Prisma Studio, seeding (`pnpm db:seed:dev` for fixtures, `pnpm db:seed` for prod-safe bootstrap).

---

# Index (auto-generate later)

TODO: build a feature → code-reference table after Parts 1–3 are filled in. Useful as a quick-jump for code reviewers.
