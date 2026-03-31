# Uplifter Platform Architecture

## Table of Contents

1. [Overview](#overview)
2. [Portal System](#portal-system)
3. [Project Structure](#project-structure)
4. [Backend Architecture](#backend-architecture)
5. [Authentication & Sessions](#authentication--sessions)
6. [Database Schema](#database-schema)
7. [Financial System](#financial-system)
8. [Communications](#communications)
9. [Background Jobs](#background-jobs)
10. [External Integrations](#external-integrations)
11. [Infrastructure & Deployment](#infrastructure--deployment)
12. [Developer Experience](#developer-experience)

---

## Overview

Uplifter is a **multi-tenant SaaS platform** for sports and athletics club management. Each customer (an `Organization`) gets a fully isolated workspace with programs, athletes, billing, communications, competitions, evaluations, and more.

**Tech stack at a glance:**

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth.js with multi-portal subdomain support
- **Payments:** Adyen (direct charges + Balance Platform for payouts)
- **Email:** Amazon SES (production) / MailHog (local)
- **SMS:** Twilio
- **Storage:** AWS S3 (production) / MinIO (local)
- **Caching:** Upstash Redis
- **IaC:** Terraform + ECS Fargate / EKS with Helm

---

## Portal System

The platform routes by subdomain. A single Next.js deployment serves every portal — the middleware inspects the subdomain and rewrites the request internally to the appropriate app directory segment.

| Subdomain       | Purpose                                | Primary Users     | Status  |
| --------------- | -------------------------------------- | ----------------- | ------- |
| `login.`        | Authentication, password reset, signup | All users         | Live    |
| `startup.`      | New organization registration          | New customers     | Live    |
| `admin.`        | Organization management dashboard      | Org Admins, Staff | Live    |
| `superadmin.`   | Platform-wide administration           | Uplifter staff    | Live    |
| `pos.`          | Point of Sale terminal                 | Front desk staff  | Live    |
| `coach.`        | Mobile-friendly coach portal           | Coaches           | Demo    |
| `events.`       | Event check-in portal                  | Staff, Volunteers | Hidden  |
| `athletes.`     | Parent/Athlete self-service            | Parents, Athletes | Live    |
| `[org-slug].`   | Public marketing site                  | Public visitors   | Live    |
| `feedback.`     | Feature requests & roadmap             | All users         | Live    |
| `competitions.` | Competition browsing & management      | Staff, Parents    | Planned |
| `results.`      | Competition results & scores           | Staff, Parents    | Planned |

**Environments:**

| Env         | Base Domain              | Notes            |
| ----------- | ------------------------ | ---------------- |
| Production  | `uplifter.app`           | Live traffic     |
| Staging     | `upliftergymnastics.com` | QA/UAT           |
| Development | `uplifterdev.com`        | Team dev testing |
| Local       | `*.localhost:3000`       | Local dev        |

**Tenant site rewriting:** A visit to `gym-name.uplifter.app/checkout` is rewritten internally to `/sites/gym-name/checkout`. Client-side navigation inside tenant sites must use simple paths (`/checkout`, `/register`) — never include the `/sites/{slug}/` prefix in `Link` hrefs or `router.push` calls. The middleware inserts that prefix transparently.

---

## Project Structure

```
clubs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Grouped auth routes (login, reset)
│   │   ├── api/                # ~391 API routes across 70 directories
│   │   ├── dashboard/          # Admin portal pages
│   │   ├── athletes/           # Athlete/parent portal pages
│   │   ├── coach/              # Coach portal pages
│   │   ├── superadmin/         # Superadmin portal pages
│   │   ├── pos/                # POS terminal pages
│   │   └── sites/[slug]/       # Tenant marketing site pages
│   ├── components/             # Shared UI components (79 directories)
│   ├── lib/                    # Services, utilities, integrations (81 files)
│   ├── hooks/                  # Custom data-fetching hooks (32 files)
│   ├── types/                  # TypeScript type definitions (21 files)
│   ├── store/                  # Zustand stores (calendar, lesson plan)
│   └── middleware.ts           # Subdomain routing + session handling
├── prisma/
│   ├── schema.prisma           # 5,100+ line database schema
│   ├── migrations/             # ~120 migration files
│   ├── seed.ts                 # Production seed data
│   └── seed-dev.ts             # Development seed data
├── docs/                       # Supplementary documentation
├── infrastructure/             # Terraform modules
├── charts/                     # Helm charts (EKS)
├── gitops/                     # ArgoCD application definitions
├── scripts/                    # Deployment + secrets management
└── Dockerfile                  # Multi-stage container build
```

### Key `src/lib/` files

| File                 | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `db.ts`              | Prisma client + `getScopedDb()` for tenant isolation       |
| `auth.ts`            | NextAuth.js config (providers, adapter, session callbacks) |
| `auth-cookies.ts`    | Domain-aware cookie naming per environment                 |
| `env-domains.ts`     | Environment → domain mappings                              |
| `email.ts`           | SES email service (1,300+ lines, templates, campaigns)     |
| `sms-service.ts`     | Twilio SMS service (campaigns, phone pool routing)         |
| `adyen.ts`           | Adyen payment client (sessions, refunds, webhooks)         |
| `adyen-platform.ts`  | Adyen Balance Platform (payouts, onboarding)               |
| `storage.ts`         | S3/MinIO file storage abstraction                          |
| `redis.ts`           | Upstash Redis (analytics, visitor tracking)                |
| `feature-toggles.ts` | Per-org feature flag resolution                            |
| `qbo.ts` / `xero.ts` | Accounting integration clients                             |
| `logger.ts`          | Structured logging                                         |

---

## Backend Architecture

### Request Lifecycle

```
User visits admin.uplifter.app
        ↓
middleware.ts
  - Parses subdomain
  - Checks NextAuth session cookie
  - Redirects to login if unauthenticated
  - Rewrites internal URL (e.g., /dashboard)
        ↓
Next.js App Router
  - Server Component renders the page
  - Calls API routes or reads DB via Prisma directly in server components
        ↓
API Route Handler
  1. getAuthSession() → verify auth
  2. Parse + validate request (Zod)
  3. getScopedDb(organizationId) → tenant-scoped DB access
  4. Business logic
  5. NextResponse.json()
```

### API Organization

Routes live under `src/app/api/` and follow a REST pattern. All routes use `NextResponse.json()` with standard HTTP status codes. There is no tRPC or GraphQL layer — it's plain REST.

Categories of note:

- `api/auth/` — NextAuth routes + OAuth bridge + MFA
- `api/webhooks/adyen/` — Payment event webhooks (HMAC-verified)
- `api/webhooks/twilio/` — Inbound SMS webhooks
- `api/webhooks/ses/` — SES email event webhooks (via SNS)
- `api/cron/` — 14 scheduled job endpoints (called by Vercel Cron)
- `api/queue/` — Registration queue management (enter, status, reserve, complete)

### Tenant Isolation (`getScopedDb`)

This is a critical security boundary. `getScopedDb(organizationId)` returns a Prisma client with a Proxy wrapper that automatically injects `organizationId` into every `findMany`, `findFirst`, `create`, `update`, and `delete` call for models in the `TENANT_MODELS` list.

```typescript
// Models with a direct organizationId column — use getScopedDb
const scopedDb = getScopedDb(session.user.organizationId);
const programs = await scopedDb.program.findMany(); // org filter injected automatically

// Models scoped via relation chain — filter manually
const enrollments = await db.enrollment.findMany({
  where: { program: { organizationId } },
});

// Inside transactions — getScopedDb doesn't propagate, add a manual check
const result = await db.$transaction(async (tx) => {
  const record = await tx.program.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!record) throw new Error("Not found");
  return tx.program.update({ where: { id }, data });
});
```

**Never** trust `organizationId` from request bodies, query params, or headers. Always derive it from `session.user.organizationId`.

### Data Fetching (Client Side)

The app does not use React Query or TanStack Query. Instead, 32 custom hooks in `src/hooks/` wrap a custom HTTP client (`src/lib/api-client.ts`) that provides typed `api.get()`, `api.post()`, `api.patch()`, `api.put()`, and `api.delete()` methods with centralized error handling via an `ApiError` class.

### State Management

- **Zustand** for lightweight UI state (`useCalendarStore`, `useLessonPlanStore`)
- **Custom hooks** for server state (no external state library)
- **React Context** for layout-level concerns (active org, session user)

---

## Authentication & Sessions

### Providers

| Provider                 | Notes                                       |
| ------------------------ | ------------------------------------------- |
| Email + Password         | Custom Credentials provider, bcrypt hashing |
| Google OAuth             | Standard OAuth 2.0                          |
| Microsoft Entra ID       | Azure AD OAuth                              |
| Email verification codes | OTP-style login + MFA                       |

### Multi-Portal Sessions

OAuth providers run on the base login subdomain. After OAuth completes, a session bridge (`api/auth/session-bridge`) transfers the session token to the appropriate portal subdomain cookie. This is required because cookies are domain-scoped.

The custom Prisma adapter (`createUplifterAdapter` in `auth.ts`) handles:

- Mapping Prisma's `avatar` field to NextAuth's `image`
- Auto-creating Uplifter staff emails as super admins on first login
- Defaulting new OAuth users to the `PARENT` role

### Session Shape

Sessions carry `organizationId` (the currently active org), `role`, and `memberId`. Users can belong to multiple organizations — switching orgs updates the active `organizationId` in the session without re-authentication.

---

## Database Schema

### Entity Groups

The schema has ~5,100 lines and 80+ models organized into these domains:

#### Foundation

- **Organization** — top-level tenant, owns all data
- **User** — global identity, not org-scoped
- **OrganizationMember** — ties a User to an Org with a role (ADMIN, COACH, VOLUNTEER, ACCOUNTANT, CUSTOM, PARENT)
- **Session / Account / VerificationToken** — NextAuth primitives

#### Athletes & Guardians

- **Athlete** — the core subject (name, DOB, gender, medical)
- **AthleteGuardian** — many guardians per athlete, `isPrimary` flag
- **OrganizationAthlete** — junction table for org visibility + status
- **GuardianClaimRequest** — multi-family support request flow

#### Programs & Scheduling

- **Program** — offering with RFC 5545 `rrule` recurrence, pricing, restrictions
- **ProgramInstance** — individual generated session from the rrule
- **Enrollment** — athlete registration to a program (program-level)
- **InstanceRegistration** — per-session registration (when `registrationType = PER_INSTANCE`)
- **InstanceAttendance** / **Attendance** — attendance tracking per instance or event

#### Memberships & Passes

- **MembershipGroup** — membership type definition
- **MembershipInstance** — specific period (e.g., "2025 Annual")
- **AthleteMembership** — athlete's purchased membership
- **Pass** — session pass (with limits, auto-renew, covered programs)
- **AthletePass** — athlete's purchased pass

#### Events

- **Event** — standalone event with date/time, location, optional program link
- **EventStaff** — staff assignments to events

#### Evaluations & Skills

- **Level** — proficiency level (e.g., "Bronze", "Level 1")
- **Skill** — individual evaluatable skill, linked to a Level
- **EvaluationTemplate** — reusable blueprint (skills, scoring type, completion thresholds)
- **Evaluation** — per-athlete assessment instance
- **EvaluationSkill** — skill rating within an evaluation
- **AthleteSkillProgress** — aggregated skill tracking (attempt count, best result)
- **Achievement** — badge definition tied to a template
- **AthleteAchievement** — earned badge record

#### Competitions

- **Sport** → **SportEvent** (e.g., "100m") → **SportAgeCategory** (e.g., "U10")
- **SportEventEligibility** — which event+age combos are allowed
- **Competition** — competition event with pricing, restrictions, registration windows
- **CompetitionCategory** — links a competition to a sport event + age category
- **CompetitionEntry** — athlete's entry with seed mark submission
- **CompetitionResult** — result with placement, heat, DNF/DNS/DQ, PB flags
- **CompetitionTeam** — relay/team groupings

#### Financial

- **Invoice** — customer invoice with subtotal, tax, processing fee
- **LineItem** — connects billing to programs/events/athletes/memberships/passes/products
- **Payment** — payment record (method, status, Adyen transaction link)
- **Transaction** — Adyen PSP reference record
- **Payout** — Adyen settlement batch
- **Discount** — discount codes (percentage or fixed, scoped by user/product type)
- **GLCode** — general ledger code (chart of accounts)
- **LedgerEntry** — journal entry for accounting
- **RecurringCharge** — auto-billing for memberships, passes, enrollments
- **PaymentMethod** — stored Adyen token per guardian

#### Communications

- **SmsCampaign** / **Message** — bulk SMS with targeting and scheduling
- **EmailCampaign** / **EmailMessage** — bulk email with open/click tracking
- **Conversation** — per-user threaded chat (SMS or web)
- **Announcement** — org-scoped announcements with read receipts
- **SystemAnnouncement** — platform-wide superadmin announcements
- **NotificationRule** — trigger-based automated notifications (18+ trigger types)
- **NotificationTemplate** — message template per rule
- **NotificationLog** — audit trail of sent notifications
- **NotificationDeduplication** — prevents duplicate rule firings

#### Facilities

- **Facility** — physical location with operating hours, capacity
- **Space** — room/area within a facility
- **Equipment** — apparatus/equipment with condition and status tracking
- **FacilityAssignment** — staff assignments to facilities

#### Products & POS

- **Product** — retail product with inventory
- **ProductVariant** — color/size variants with inventory tracking
- **StockMovement** — inventory transaction log
- **Order** — purchase order (POS or online)

#### Waivers

- **Waiver** — waiver document with pages
- **WaiverPage** — individual page with HTML content
- **WaiverSignature** — per-page digital signature (base64 PNG)
- **WaiverAcceptance** — completion record (all pages signed)

#### Platform Subscription

- **SubscriptionPlan** — SaaS tier definition with feature flags and limits
- **OrganizationSubscription** — active plan with Adyen recurring detail
- **OrganizationFeatureOverride** — per-org feature toggle overrides
- **SubscriptionInvoice** — monthly platform billing invoice
- **SubscriptionPaymentAttempt** — payment attempt record

#### Accounting Integrations

- **AccountingConnection** — QBO/Xero OAuth connection per org
- **AccountingAccountMapping** — GL code ↔ external account mapping
- **AccountingSyncQueue** — pending sync operations
- **AccountingSyncLog** — audit trail of sync runs

### Design Patterns

**Multi-tenancy:** `organizationId` on every org-scoped table. The `getScopedDb()` Proxy enforces this automatically for `TENANT_MODELS`.

**Shared data:** `Athlete`, `User`, and `AthleteMedicalInfo` are intentionally not fully org-scoped. Medical records are shared across orgs for athlete safety. Athletes are surfaced to orgs via `OrganizationAthlete`.

**Soft deletes:** Status fields (`isActive`, `status: ARCHIVED`, etc.) are used instead of hard deletes in most cases.

**Recurrence:** Programs use RFC 5545 `rrule` strings. `ProgramInstance` records are generated from the rule.

**Audit trails:** `OrganizationStatusLog` for org lifecycle events, `NotificationLog` for all sent notifications, `AccountingSyncLog` for integration syncs.

**Feature gating:** `SubscriptionPlan.featureToggles` (JSON) sets defaults; `OrganizationFeatureOverride.featureToggles` (JSON) lets admins override per org. Resolved at runtime via `src/lib/feature-toggles.ts`.

---

## Financial System

### Payment Flow

```
Guardian selects items
        ↓
LineItems created (linked to program/event/membership/pass/product + GLCode)
        ↓
Invoice generated (subtotal + tax + processing fee)
        ↓
Adyen Session created (frontend payment component)
        ↓
Adyen processes payment
        ↓
Webhook received at /api/webhooks/adyen (HMAC-verified)
        ↓
Transaction + Payment records created
        ↓
Invoice marked PAID
        ↓
Payout batched by Adyen Balance Platform → Settlement
```

### Adyen Two-Tier Model

- **Direct payments:** One-off charges via Adyen Sessions API
- **Balance Platform:** Adyen for Platforms (KirraCapital company / UplifterLLC balance platform). Organizations onboard as account holders. Funds sweep to their balance account, then are paid out to their bank.

### Recurring Billing

`RecurringCharge` records track auto-billing for memberships, passes, and enrollments. The `recurring-billing` cron job runs daily at 8am and processes all charges with `nextChargeDate <= today` and status `ACTIVE`.

Dunning (failed payment recovery) is handled by the `subscription-dunning` cron (daily at 12pm) which retries and sends warning emails based on `dunningWarningsSent` count on the Organization.

---

## Communications

### Three-Layer Messaging Model

| Layer             | Use case                         | Models                                |
| ----------------- | -------------------------------- | ------------------------------------- |
| **Campaigns**     | Bulk sends to filtered audiences | `SmsCampaign`, `EmailCampaign`        |
| **Notifications** | Automated trigger-based messages | `NotificationRule`, `NotificationLog` |
| **Conversations** | Direct 1:1 chat (SMS or web)     | `Conversation`, `Message`             |

### Notification Triggers (18+)

`NotificationRule` supports: `MEMBERSHIP_EXPIRY`, `MEMBERSHIP_EXPIRED`, `PAYMENT_DUE`, `PAYMENT_OVERDUE`, `PAYMENT_RECEIVED`, `PROGRAM_REMINDER`, `PROGRAM_ENROLLMENT`, `PROGRAM_CANCELLATION`, `EVENT_REMINDER`, `EVENT_REGISTRATION_OPEN/CLOSE`, `ATTENDANCE_MISSED`, `SKILL_ACHIEVED`, `EVALUATION_DUE`, `EVALUATION_COMPLETED`, `BIRTHDAY`, `WAITLIST_OPENING`, `RECURRING_CHARGE_*`, and `CUSTOM`.

The `process-notifications` cron runs every 5 minutes. `NotificationDeduplication` prevents the same rule from firing twice for the same entity/user combination.

### Phone Number Routing

Twilio numbers are assigned to orgs via `SmsNumberAssignment`. The `SMS_PHONE_POOL` env var provides a comma-separated list of available numbers. Inbound SMS replies route back to the correct org's `Conversation` via webhook at `/api/webhooks/twilio`.

---

## Background Jobs

14 Vercel Cron jobs defined in `vercel.json`. All are called as HTTPS requests to `/api/cron/{job}` with a `CRON_SECRET` header for verification.

| Job                     | Schedule          | Purpose                                          |
| ----------------------- | ----------------- | ------------------------------------------------ |
| `expire-reservations`   | Every minute      | Clean up expired registration queue reservations |
| `process-notifications` | Every 5 min       | Send pending notification rules                  |
| `accounting-sync`       | Every 15 min      | Sync transactions to QBO/Xero                    |
| `sms-campaigns`         | Every minute      | Process scheduled SMS campaign sends             |
| `recurring-billing`     | Daily 8am         | Charge recurring memberships/passes              |
| `membership-renewal`    | Daily 6am         | Generate renewal membership instances            |
| `pass-renewal`          | Daily 6am         | Renew auto-renew passes                          |
| `subscription-dunning`  | Daily 12pm        | Retry failed subscription payments               |
| `subscription-billing`  | 1st of month 12pm | Generate platform subscription invoices          |
| `holiday-announcements` | Daily 8am         | Create holiday closure announcements             |
| `holiday-reminders`     | Daily 12pm        | Send holiday reminder emails                     |
| `seasons`               | Daily 5am         | Handle season transitions                        |
| `cleanup`               | Sundays 3am       | Purge expired tokens, stale queue entries        |
| `payment-method-check`  | Mondays 2pm       | Validate stored payment methods                  |

---

## External Integrations

| Service               | Purpose                                 | Key Files                               |
| --------------------- | --------------------------------------- | --------------------------------------- |
| **Adyen**             | Payments + payouts                      | `lib/adyen.ts`, `lib/adyen-platform.ts` |
| **AWS SES**           | Transactional + campaign email          | `lib/email.ts`                          |
| **Twilio**            | SMS (campaigns + chat)                  | `lib/twilio.ts`, `lib/sms-service.ts`   |
| **AWS S3 / MinIO**    | File and media storage                  | `lib/storage.ts`                        |
| **Upstash Redis**     | Visitor analytics + caching             | `lib/redis.ts`                          |
| **QuickBooks Online** | Accounting sync                         | `lib/qbo.ts`                            |
| **Xero**              | Accounting sync                         | `lib/xero.ts`                           |
| **Google OAuth**      | Social login                            | `lib/auth.ts`                           |
| **Microsoft Entra**   | SSO for enterprise orgs                 | `lib/auth.ts`                           |
| **Sentry**            | Error tracking (client + server + edge) | `next.config.mjs`                       |
| **Stadia Maps**       | Facility map display                    | `NEXT_PUBLIC_STADIA_MAPS_API_KEY`       |

### Accounting Sync Flow

```
Invoice / Payment created in Uplifter
        ↓
AccountingSyncQueue entry added (CREATE or UPDATE)
        ↓
accounting-sync cron runs every 15 min
        ↓
QBO / Xero API called via OAuth access token
        ↓
AccountingSyncMapping updated (Uplifter ID ↔ external ID)
        ↓
AccountingSyncLog entry written
```

Tokens are encrypted at rest (AES-256) in `AccountingConnection.accessToken / refreshToken`.

---

## Infrastructure & Deployment

### Container Build

```dockerfile
# Multi-stage: deps → builder → runner
# Base: node:20-alpine
# Output: .next/standalone (optimized for containers)
# Exposed port: 3000
```

### Environments

| Stage      | Host              | Notes                           |
| ---------- | ----------------- | ------------------------------- |
| Local      | Docker Compose    | Postgres, Redis, MinIO, MailHog |
| Staging    | ECS Fargate       | `upliftergymnastics.com`        |
| Production | ECS Fargate / EKS | `uplifter.app`                  |

### CI/CD

- **IaC:** Terraform modules for VPC, RDS (Postgres), ElastiCache (Redis), S3, CloudFront, ALB
- **Containers:** ECS Fargate (primary) + EKS via Helm charts
- **GitOps:** ArgoCD application definitions in `/gitops/`
- **Migrations:** `prisma migrate deploy` runs on container start

### Secrets Management

Secrets are encrypted with SOPS and stored in `.env.enc`. Three helper scripts:

```bash
scripts/secrets-decrypt.sh   # Decrypt to .env
scripts/secrets-encrypt.sh   # Encrypt .env to .env.enc
scripts/secrets-edit.sh      # Edit encrypted secrets in place
```

### Security Headers (`next.config.mjs`)

- **CSP** — environment-aware, blocks unauthorized script/connect sources
- **X-Frame-Options: DENY**
- **X-Content-Type-Options: nosniff**
- **HSTS** — cloud environments only
- **X-Robots-Tag: noindex** — non-production environments

---

## Developer Experience

### Local Stack

```bash
# Required local services (Docker)
PostgreSQL 16
Redis
MinIO (S3-compatible storage)
MailHog (SMTP for email preview)
```

### Common Commands

```bash
pnpm dev              # Start Next.js dev server with hot reload
pnpm build            # Build + generate Prisma client
pnpm start            # Run production build
pnpm lint             # ESLint + Next.js linting
pnpm prisma studio    # Open Prisma Studio (DB GUI)
pnpm prisma migrate dev --name <name>   # Create a new migration
pnpm prisma migrate deploy              # Apply pending migrations
pnpm prisma db seed                     # Run seed.ts
```

### Code Quality Tools

- **TypeScript strict mode** — no implicit any, strict null checks
- **ESLint** — Next.js config
- **Prettier** — formatting enforced
- **Husky + lint-staged** — pre-commit hooks run lint on changed files
- **Commitlint** — enforces conventional commit message format
- **Path aliases** — `@/*` maps to `src/*` (configured in `tsconfig.json`)

### Testing

There is currently no test suite configured. No Jest, Vitest, or Playwright setup exists in `package.json`.

### Adding a New API Route

Standard checklist from `src/app/api/README.md`:

- [ ] Check `getAuthSession()` — return 401 if missing
- [ ] Derive `organizationId` from `session.user.organizationId` only — never from request input
- [ ] Use `getScopedDb(organizationId)` for models in `TENANT_MODELS`
- [ ] Filter relation-scoped models manually through the org chain
- [ ] Inside `$transaction`, add a defensive org check before mutating
- [ ] Validate request body with Zod before using any values
- [ ] Use `parseDateOnly()` for date-only fields (see `docs/DATE-HANDLING.md`)

### Adding a New Schema Model

1. Add the model to `prisma/schema.prisma`
2. Run `pnpm prisma migrate dev --name <descriptive-name>`
3. If the model has a direct `organizationId`, add it to the `TENANT_MODELS` array in `src/lib/db.ts`
4. Add corresponding TypeScript types to `src/types/`

### Standard UI Components

**Phone inputs** — always use `PhoneInput` from `@/components/ui/phone-input`. Validate with `isValidPhoneNumber()`. Store in E.164 format. Never use `<input type="tel">`.

**Address fields** — use `COUNTRIES` and `getRegionsForCountry()` from `@/lib/location-data` for country/state selects. Reset state when country changes.

**Data tables** — use TanStack React Table v8. See `docs/data-table-migration.md`.

**Date fields** — see `docs/DATE-HANDLING.md` for the `parseDateOnly()` pattern. Dates without a time component must not use `new Date()` directly (timezone drift).

### Multi-Organization Users

A single user account can belong to multiple organizations with different roles. The session tracks the currently active `organizationId`. Switching orgs via the sidebar switcher updates the session. Be aware when writing code that touches `User` records — the current org context determines what data is visible, not the user's global identity.

### Shared Medical Data

`AthleteMedicalInfo` is intentionally **not** org-scoped. Medical records are shared across organizations for athlete safety. Do not add `organizationId` filtering when querying this model.
