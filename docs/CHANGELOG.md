# Twizzle Changelog

Running log of features and fixes shipped to `main`. Newest first.
Manual verification steps for each entry live in
[`docs/TESTING.md`](./TESTING.md).

---

## 2026-05-29

### Fix: command palette cross-subdomain routing

The palette was calling `router.push()` (same-origin only) for every
nav item. A coach who landed on the admin subdomain and picked any
`/coach/*` item would 404 against `admin.uplifter.localhost:3000/coach`.

Fix: a small `portalSubdomainForPath` helper maps `/dashboard` →
`admin`, `/coach` → `coach`, `/superadmin` → `superadmin`. When the
target subdomain differs from the current one, the palette now
`window.location.assign`s to the absolute URL on the right subdomain.
Same-subdomain navigations keep using `router.push` for the snappy
client-side transition.

---

### Phase 0.1 — Global Cmd+K command palette

Keyboard-first launcher that puts every page, athlete, program, and
action one shortcut away. Mounted in both the admin (`/dashboard`) and
coach (`/coach`) authenticated layouts; invisible on unauthenticated
routes.

- **Shortcut:** `Cmd+K` (macOS) / `Ctrl+K` (others) toggles the palette.
  Escape closes it. The existing sidebar `⌘K` hint is now a clickable
  button that also opens the palette.
- **Discovery button:** "Search ⌘K" button added to the top-bar
  (`SiteHeaderActions`) in both layouts.
- **Sections:** Navigate (role-filtered admin + coach routes), Athletes
  (debounced 250 ms search against `/api/athletes?search=`), Programs
  (same pattern against `/api/programs?search=`), Actions (New athlete,
  New program, New evaluation, Switch organization, Log out), Recent
  (last 5 pages from `localStorage`).
- **Performance:** global `keydown` listener is registered eagerly;
  dialog content is already in the bundle (no lazy-load overhead on
  first open). Search debounced at 250 ms.
- **Accessibility:** respects `prefers-reduced-motion` via a global CSS
  rule in `globals.css`.

---

### Phase 0.5 — Micro-animations on standard interactions

Added subtle, consistent animations to design-system primitives so every
page inherits them without per-page edits.

- **Button press** — buttons scale to 96% on press (Tailwind `active:`)
- **Focus ring** — 200 ms fade-in transition on `:focus-visible`
- **Page transitions** — content fades in from y+8 over 200 ms in
  dashboard / coach / superadmin layouts (`motion.main`)
- **`<AnimatedCheckmark/>`** — SVG path-length draw-in for success states
- **`<CountUp value={n}/>`** — number counter using framer-motion's
  `useMotionValue` + `useTransform` + `useSpring`
- **Skeleton shimmer** — CSS keyframe gradient sweep on the `<Skeleton>`
  primitive
- All animations respect `prefers-reduced-motion: reduce`

---

### Phase 0.6 — Sonner toasts + unified skeletons

Adopted Sonner as the single toast layer and unified all loading states
behind the canonical `<Skeleton>` primitive.

- **Toaster:** `<Toaster />` wired in root layout with
  `position="bottom-right"`, `expand`, `closeButton`, `richColors`; theme
  from `next-themes`.
- **`alert()` replaced:** all remaining browser `alert()` calls (5 call
  sites across `invoice-actions.tsx`, `grace-period-manager.tsx`)
  replaced with `toast.success` / `toast.error`.
- **`confirm()` replaced:** 17 browser `confirm()` calls across 15 files
  replaced with `toast(message, { action, cancel })` — destructive
  action moves into the action callback; cancel is a no-op. No business
  logic changed.
- **Inline error banners replaced:** `{error && <Card>…</Card>}` state
  patterns in `competitions/page.tsx` and all four analytics tabs
  removed; errors now surface via `toast.error()` in the catch block.
- **Skeleton:** `src/components/ui/skeleton.tsx` now accepts `width`,
  `height`, and `rounded` props alongside `className`.
- **Loading states:** added `loading.tsx` for all 15 superadmin
  sub-routes that were missing one.

---

### Delete Metro Sports demo org from seed-dev.ts (Commit A)

Removed all Metro Sports Complex seed data from `prisma/seed-dev.ts` as
part of the skating-only rebrand (Appendix A, Commit A). Metro was a
multi-sport demo org that no longer fits the product's skating-club
focus.

**What was removed:**

- Metro Sports organization, Adyen account, org features, sport associations
- Metro admin/coach/volunteer users and all OrganizationMember rows
- Metro facility, spaces, equipment, facility assignments/hours/notes
- Metro parents (4), athletes (6), guardian links, payment methods
- Metro levels, categories, programs, program instances, registrations
- Metro discounts, membership group/instances, athlete memberships
- Metro enrollments, events (historical + current), attendance records
- Metro invoices, payments, GL codes, ledger entries
- Metro skills, evaluation templates, evaluations, achievements, skill progress
- Metro announcements, website config, POS products, stock movements, media
- Metro staff employment, certifications, availability, shifts, template
- Metro medical form config, custom questions, athlete medical info
- Metro email usage, email campaigns, notification rules
- Metro waiver (2 pages) and program waiver requirement
- Metro competition (Regional Athletics Meet) with tiers, categories, entries, results
- `ORG2_ID` constant declaration

**Counts after deletion:**

| Metric             | Before  | After  |
| ------------------ | ------- | ------ |
| `grep -c ORG2_ID`  | 539     | 0      |
| `grep -c ORG1_ID`  | 834     | 834    |
| `grep -ci "metro"` | ~540    | 0      |
| File lines         | ~10,479 | ~7,576 |

---

### Phase 1.3 — Athlete discipline taxonomy

Skaters can now be tagged with one or more figure-skating disciplines:
**Singles, Pairs, Ice Dance, Synchronized, Special Olympics**. Stored as
a Postgres enum array on the global `Athlete` model (not org-scoped — a
skater's discipline is a property of them, not the club).

Surfaces:

- **Admin athlete edit sheet** — new "Disciplines" section with a
  multi-select `ToggleGroup`. Multiple selections allowed.
- **Admin athlete detail header** — disciplines render as small `Badge`
  pills under the athlete's name/federation row when any are set.
- **PATCH `/api/athletes/[id]`** — accepts `disciplines: Discipline[]`,
  rejects any value not in the enum.

The filter UI on the athletes list (mentioned in the roadmap task) is
deferred to a follow-up — the schema + edit + display foundation lands
first so the data is captured before filtering becomes useful.

---

### Phase 1.2 — Federation membership prerequisite gate at enrollment

Programs now opt in to a federation-membership requirement via a new
`hasFederationMembershipRestriction` Boolean flag on `Program`. When the
flag is set, enrollment is blocked if the athlete's
`federationMemberNumber` is empty, or if their
`federationMemberExpiresAt` is before the enrollment's effective date.

The check fires in two places:

1. **Admin POST `/api/enrollments`** — returns `400` with the block
   reason before the enrollment row is created.
2. **Public/guardian checkout** (`/api/sites/[slug]/checkout/session`)
   — fails fast with an athlete-named error so the registrant can fix
   it before being charged.

The flag exposes as a Switch in the Program configuration sheet
(_Requirements_ tab). Phase 6.2 will replace the local membership check
with a live Skate Canada CRM lookup; this stays as a pre-flight.

---

### Phase 1.1 — Skate Canada / USFS / ISU member-number format validation

Added a local-only regex validator for `federationMemberNumber`. Runs
both client-side (inline error below the form input) and server-side
(Zod `superRefine` on the athlete PATCH route). Federation-aware:

- `SKATE_CANADA` → `SC-` + 6-10 digits (e.g. `SC-12345678`)
- `USFS` → `USFS-` + 4-10 digits (e.g. `USFS-123456`)
- `ISU` → permissive `[A-Z0-9-]{4,32}` until we have a stricter spec
- Unknown federations → accept any non-empty string (forward-compat)

Empty member number is always accepted (the field is optional).
Providing a member number without picking a federation surfaces "Select
a federation before entering a member number". Phase 6.2 will replace
the regex with a live Skate Canada CRM lookup; this stays as a
pre-flight.

---

## 2026-05-28

### Skating-only scope cleanup — `Competition.competitionType` dropped

Removed the multi-sport competition-type field end-to-end. Twizzle is
skating-only; the field served only an extra wizard step.

---

### Full STAR catalog + searchable template picker

Added Skate Canada's official STAR 1–Gold assessment catalog and a
search-aware template picker so coaches can navigate the ~96-template
default seed without scrolling.

- **STAR catalog** (`prisma/star-assessments.ts`): ~94 skating elements
  - **71 EvaluationTemplate test sheets per org** across five
    disciplines — Freeskate Elements (STAR 1–10), Freeskate Program
    (STAR 2–Gold), Skills (STAR 1–Gold), Dance Step Elements (STAR 1 /
    3B / 5B), Pattern Dances (STAR 2a–Gold C + Diamond), Artistic
    Program (STAR 5/7/9/Gold), Synchro (STAR 2/3/4).
- Each template encodes the Skate Canada passing rule
  (`completionType=COUNT/ALL` + threshold) and pairs with an
  Achievement that the existing auto-award service fires on completed
  evaluations.
- **Template picker** (`/dashboard/training/evaluations` → New): cmdk
  fuzzy search over name + discipline + level. Empty query shows the
  default-pinned templates first.

---

### Skate Canada CSS competition export

Download-only CSV export matching Skate Canada's Competition Software
(CSS) import format, modeled after Uplifter's
`programParticipantsSCCSS` report. Clubs generate the CSV from a
Twizzle competition and upload it in CSS to register entries.

- **Schema:** `Organization.federationSection: String?` (section code:
  ON, BC, AB, …). Migration `20260528205158`.
- **Pure builder** (`src/lib/css-export.ts`): validates each entry
  (federation # present, membership not expired, birth date, gender
  mapped to M/F, name complete, status not WITHDRAWN/SCRATCHED) and
  returns `{rows, blocked[]}`. 14-column MVP set: EventCode,
  CatEventType, Category, Discipline, RegistNo, First Name, Last
  Name, Gender, Age, Birthdate, Club, Section Representing, Country,
  EOR.
- **Serializer:** `serializeCssCsv()` produces CRLF-delimited CSV
  with proper escaping. Birthdate `MM/DD/YYYY` (CSS's expected US
  format); Ontario section magic (WO/EO/NO/CO → ON) mirrored from
  Uplifter.
- **UI:** "Export to CSS" button on the competition detail page.
  Pre-validation pass surfaces blocked athletes inline before
  download.

---

### CanSkate ribbon catalog + coach evaluation surface

Brings Skate Canada's official ribbon progression into Twizzle and
makes the coach evaluation flow ribbon-aware end-to-end.

- **Catalog seeder** (`prisma/canskate-ribbons.ts`): imports the 4
  official Skate Canada CSV catalogs (Balance, Control, Agility,
  Pre-CanSkate) verbatim. Idempotent `seedCanSkateRibbons(prisma,
orgId)` creates the Pre-CanSkate Level, **136 deduped Skill rows,
  19 EvaluationTemplate test sheets** (6 stages × 3 ribbons +
  Pre-CanSkate), 19 Achievement rows, and 145 EvaluationTemplateSkill
  links per org. Wired into `skate-seed.ts`.
- **Auto-awarding** already worked via the existing
  `lib/services/achievement.ts:checkAndAwardAchievements()`; ribbons
  earn automatically when an evaluation passes every required goal.
- **Shared helper** (`src/lib/canskate-ribbons.ts`):
  `getCanSkateRibbonMeta()` + Tailwind ribbon-dimension color tokens
  used by both server and client.
- **API:** `/api/evaluation-templates` returns `ribbonMeta` per
  template; `POST/PUT /api/evaluations` decorate
  `newAchievements[]` with `ribbonMeta` for the toast UI.
- Renames local `Ribbon` interface to `RibbonItem` to avoid an
  ESLint shadow of `lucide-react`'s `Ribbon` icon.

---

### Track Skate Canada / USFS federation membership on athletes

Per-organization federation membership tracking on `OrganizationAthlete`
so clubs can record skater registration with Skate Canada, U.S. Figure
Skating, or ISU — a prerequisite for competition entry, insurance, and
the CSS export above.

- **Schema** (migration `20260527232645`):
  - `federationName: String?` — e.g. `"SKATE_CANADA"`, `"USFS"`, `"ISU"`.
  - `federationMemberNumber: String?` (indexed for lookup).
  - `federationMemberExpiresAt: DateTime?`
- **API:** GET / POST / PATCH `/api/athletes` surface and accept the
  new fields. Added to `STAFF_ONLY_FIELDS` so guardians can't
  self-assign.
- **UI:**
  - Athlete edit form: new **Federation Membership** section
    (federation dropdown, member-number input, expiry date picker).
    Number/date inputs disabled until a federation is selected.
  - Athlete detail header: inline `SC# XXX` badge with a red
    `(expired)` marker when past expiry.
  - Athlete detail Overview tab: dedicated Federation Membership
    card with full member details + Active/Expired badge.

---

### Roadmap doc (`docs/ROADMAP.md`)

Six-phase plan for closing Uplifter parity on Skate Canada integration

- carry-over legacy cleanup. Includes parity scorecard mapping each task
  to the Uplifter feature it closes.

---

### Batch 1 — Upstream security + tenant-isolation fixes (4 commits)

#### USC-150 — `getScopedDb` upsert tenant reassignment guard

Prevents a scoped Prisma client from writing a row into another org's
tenancy via `.upsert({ data: { organizationId: <other-org> } })`.

#### Tenant leak on org announcements (marketing route)

Fixed cross-tenant exposure where a marketing-route announcement query
returned announcements from another org.

#### USC-940 — zizmor GHA security findings (manual port)

Pinned action versions, added `permissions: contents: read`, set
`persist-credentials: false` on checkout steps, bumped checkout@v4→v6
and `aws-secretsmanager-get-secrets` v2→v3. New `.github/zizmor.yaml`
ref-pin policy.

#### USC-888 — staff-only role gate on `/api/guardians/[id]`

Closes IDOR sibling of USC-679 — a PARENT-role user could fetch any
other parent's profile by ID. Now gated on `families.view` permission.

---

### Batch 2 — Adyen / refund / webhook hardening (2 standalone commits)

#### USC-586 — wallet-backed stored payment methods filter by brand

`amex_googlepay` and similar stored methods have type `"scheme"`, so
`isWalletType` was returning false. Now normalizes via
`normalizePaymentMethodType` before the check.

#### USC-733 — Prisma tx timeout + parallel webhook upserts

Parallelizes sequential `InstanceRegistration` upserts in
`processInvoiceRegistrations` (`for` loop → `Promise.all`); bumps Prisma
interactive transaction timeout to 10s on the webhook/checkout path and
15s on waitlist-promotion.

> **Deferred from Batch 2 (~25 commits):** all gated on porting USC-477
> (`97c21fdf`) — the foundation refactor that extracts
> `src/lib/adyen-webhook-handlers.ts`. See `docs/ROADMAP.md` for the
> dependency map.

---

### Batch 3 — Sentry + observability (3 commits)

#### USC-660 — `logger.exception` auto-routes to Sentry (partial port)

Every `logger.exception(msg, err)` call now also fires
`Sentry.captureException(err)` with `level=fatal` for
`PrismaClientRustPanicError` / `PrismaClientInitializationError`, and
`level=error` for everything else. Errors with these names mean the DB
engine is gone; they were previously silent.

> **Partial:** upstream's redis.ts changes target `ioredis` (we use
> `@upstash/redis`) and db.ts changes target `pg Pool` (we don't use the
> raw pool). Those land if/when we adopt those infrastructure changes.

#### USC-517 — cron heartbeat + Sentry check-in monitoring

New `CronHeartbeat` table; every cron upserts `lastSuccessAt` on
successful completion AND calls Sentry's `captureCheckIn` /
`endCronMonitoring`. Sentry's native cron miss-detection now alerts when
a cron misses its expected interval.

#### USC-510 — production Sentry setup (DSN injection, fingerprinting, fatal alerting)

- `promote-production.yml` rebuilds the image from source with prod
  Sentry DSN baked in (previous retag approach baked staging DSN).
- `Dockerfile` adds `ENV SENTRY_RELEASE=$SENTRY_RELEASE` so Sentry
  releases are named correctly.
- `next.config.mjs` routes `withSentryConfig` to `uplifter-us-prod` when
  `APP_ENVIRONMENT=production`.
- Sentry configs add **fingerprint normalization** — errors with dynamic
  UUIDs / numeric IDs collapse into one issue instead of fragmenting
  per-ID.
- Cron crashes in `subscription-billing` / `subscription-dunning` now
  fire fatal Sentry events instead of silent `console.error`.

---

### Batch 6 — Server-side pagination infrastructure (USC-952)

New opt-in mode on `<DataTable>` and a standalone `<ServerPagination>`
control + `useServerPagination()` hook for non-table lists. Default
client-side pagination path is unchanged for existing callers.

> **Direct unlock:** Roadmap Phase 5.2 (`FederationSubmission` admin
> queue page) can wire straight to this instead of building pagination
> from scratch.

---

## 2026-05-27

### Figure-skating rebrand + drop Rotation models

Adapted the project for figure skating, replacing the gymnastics-centric
data model and UI.

- **Schema:** drops `Rotation` / `RotationSkill` Prisma models (no
  skating equivalent). Migration `20260527213526_drop_rotation_models`.
- **New seed** (`prisma/skate-seed.ts`): canonical
  CanSkate / STARSkate / Adult / Synchro taxonomy — 4 categories, 17
  levels (CanSkate Stage 1–6, STAR 1–10, Gold), 39 ISU-aligned skills
  grouped by element type (Edges, Footwork, Jumps, Spins, Field Moves,
  Conditioning), and 5 representative test-sheet templates.
- **Seed rewrite** (`seed-dev.ts`): _Sunrise Gymnastics_ → _Sunrise
  Skating Club_; _Demo Gymnastics_ → _Demo Skating Club_; JO/USAG →
  Pre-Juvenile/PSA; gymnastics skill IDs preserved so evaluation
  templates still resolve; competition template Age × Apparatus →
  Age × Discipline.
- **UI sweep:** rotation labels → **Session Blocks** in lesson plan
  UI; facility placeholders updated (Balance Beam Area → Rink A,
  Beam #3 → Harness #2); SEO / keywords / structured-data
  figure-skating themed; campaign-wizard examples skating-themed;
  competitionType label `GYMNASTICS` → `FIGURE_SKATING`.
- Removes the demo `/dashboard/training/rotations` page and its
  feature-status entry.
- Docs (`README`, `SEEDING.md`, `platform-architecture.md`) updated.

---

### Rebrand leapfrog/uplifter → twizzle (local infra only)

Renames local infra (docker container names, Postgres DB,
`DATABASE_URL`), package name, deploy workflow target, and VS Code
SQL connection from the legacy _leapfrog_/_uplifter_ naming to
_twizzle_. Removes the inherited uplifter `CODEOWNERS` entry. Adds
`.idea/` to `.gitignore`.

Adyen merchant account IDs (`KirraCapital_Leapfrog_*`) and the
LeapFrog toy-company trademark reserved-slug pattern are intentionally
left in place — those reference external identifiers.

---

## 2026-05-19 / 2026-05-20

### Speed up sidebar navigation (Turbopack + sync layout + prefetch)

Three changes that together make sidebar nav feel responsive.

- **Turbopack:** dev server switched to `next dev --turbo`. Cold-compile
  of a route drops from ~10-15 s to ~2-3 s in this codebase. The
  `dev:webpack` script is preserved as a fallback. Sentry SDK warns
  Turbopack source-map upload needs Next 15.4.1+; runtime tracing still
  works on 14.
- **Sync dashboard layout:** previously
  `dashboard/layout.tsx` ran `getAuthSession()` +
  `db.organization.findUnique()` on every navigation, blocking
  `loading.tsx` from streaming. The auth/org check now lives in a
  `Suspense`'d `DeactivationGuard` child so the layout and route-level
  skeleton stream immediately.
- **Eager sidebar prefetch:** the accordion-by-default sidebar leaves
  `<Link>`s unmounted in collapsed sections, so Next's viewport-
  triggered prefetch never fires. Sidebar now calls `router.prefetch`
  for every sub-item on mount.

---

### Cache list/detail fetches + add route-level skeletons

Module-level stale-while-revalidate cache (60 s TTL) on 25 legacy
data-fetching hooks so revisiting a page renders cached data instantly
while a background refresh updates it.

- Pages now show a `<Skeleton>` table or card-grid in place of the
  full-page `Loader2` spinner on first load.
- Four new `loading.tsx` files cover the dashboard route tree (generic
  table) plus tailored shapes for programs, reports, and athlete
  detail.
- **Public API of each hook is unchanged.** Mutations invalidate the
  cache so create/update/delete still see fresh data.

---

### Collapse admin sidebar sections by default (accordion)

Sidebar sections previously rendered as uncontrolled `Collapsible`s
with `defaultOpen=true` on desktop — every section expanded at all
times. Switch to a controlled `openSection` state so all sections
start collapsed and only one can be open at a time — opening a new
section closes the previous one. Search behavior is unchanged: an
active query still force-opens all matching sections so results stay
visible.

---

### Fix: skip fail-closed rate limiting in dev when Redis is unconfigured

`checkRateLimit` previously conflated "Redis errored mid-call" with
"Redis not configured at all" and returned 429 for both when
`failClosed` was set. Made local sign-in impossible on machines without
Upstash credentials, since the NextAuth route uses `checkAuthRateLimit`
with `failClosed: true`. Gates the fail-closed branch on `!isDev` so
production behavior is unchanged.
