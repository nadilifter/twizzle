# Twizzle Changelog

Running log of features and fixes shipped to `main`. Newest first.
Manual verification steps for each entry live in
[`docs/TESTING.md`](./TESTING.md).

---

## 2026-06-01

### Phase 6.2 — Skate Canada live membership lookup

Adds the first user-visible Skate Canada API call: lookup an athlete's
contact in the SC CRM and surface a per-field diff against Twizzle's
local data. Builds on the Phase 6.1 SOAP foundation.

**`SkateCanadaClient.getContact(input)`** (added to `src/lib/skate-canada/client.ts`)

Two lookup modes:

- `{ contactGuid }` — direct GUID lookup.
- Demographic — `{ firstName, lastName, birthdate, gender, memberNumber?, postalCodes? }`.
  Builds a Dynamics fetch with an OR clause between the demographic block
  and the member-number condition so a partial demographic mismatch is
  rescued by the member number (and vice versa). Birthdate filter
  preserves the PHP's day/month-swap fallback for ambiguous historical CRM
  data (day-of-month ≤ 12).

Returns a typed `SkateCanadaContact` (contactId, memberNumber, firstName,
lastName, birthdate, genderCode, postalCode) or `null`.

**Supporting helpers** (`src/lib/skate-canada/helpers.ts`)

- `getGenderCode(gender)` — Twizzle `GenderDeclaration` → Dynamics
  `gendercode` option-set integer (1 / 2 / 947960000 / 947960001).
- `escapeXml(value)` — XML escaping that also strips control characters
  and broken UTF-16 surrogate halves (CRM rejects them).
- `buildBirthdateConditionXml(yyyy-mm-dd)` — fetch-filter fragment with the
  noon-UTC range + flipped-month fallback.
- `fuzzyMatch(a, b)` — case-insensitive trimmed equality for diffing.

**New API endpoint**

`POST /api/athletes/[id]/skate-canada/lookup` — ADMIN-only, read-only.
Reads the athlete from Twizzle (requires birthdate + gender), calls
`getContact()` against the CRM, and returns:

```json
{
  "found": true,
  "contact": { "contactId": "...", "memberNumber": "...", ... },
  "diff": { "firstName": true, "lastName": true, "birthdate": false, "memberNumber": true }
}
```

Each `diff` field is `true` when the local value matches the CRM. Returns
**HTTP 503** with a clear error if `SKATE_CANADA_CRM_*` env vars aren't
set (so the UI degrades gracefully). All CRM errors are caught and
returned as HTTP 502 with the typed error message.

**UI**

New `<SkateCanadaLookupButton>` component, mounted in the Athlete
configuration sheet when `federationName === "SKATE_CANADA"`. Compact
result panel underneath shows each field with a green ✓ or amber ✕
showing what's in sync with the CRM, plus the SC contact GUID (first 8
chars). Empty state with a hint to save the form first if the user just
edited fields.

**Out of scope (still 6.2+):**

- Sync-back button (one-click "use SC data" → updates the athlete row).
- Bulk lookup for multiple athletes (PHP `getSuggestedContacts`).
- Live smoke test — still requires a fresh `SKATE_CANADA_CRM_APP_SECRET`.

---

### Phase 6.1 — Skate Canada CRM client (offline port)

TypeScript port of the legacy Uplifter PHP SOAP client + Azure AD auth
flow that talks to Skate Canada's Dynamics CRM. Built entirely offline —
no live credentials needed to write or unit-test the code. When fresh
test-tenant credentials are loaded into `.env`, the client is ready to
make real calls.

**New files** under `src/lib/skate-canada/`:

- **`config.ts`** — reads `SKATE_CANADA_CRM_TENANT_ID`, `_APP_ID`,
  `_APP_SECRET`, `_HOST` from environment; throws `CrmConfigError` with a
  specific message listing missing vars. `isConfigured()` lets callers
  decide whether to register the live-lookup endpoints at boot.
- **`errors.ts`** — typed error hierarchy: `CrmError` → `CrmConfigError`,
  `CrmAuthError` (with Azure error code), `CrmFaultError` (with
  faultCode), `CrmProtocolError`.
- **`oauth.ts`** — Azure AD `client_credentials` grant against
  `https://login.microsoftonline.com/{tenantId}/oauth2/token`. In-memory
  token cache keyed by tenant, expiry from `expires_on` with a 60-second
  safety margin. Wraps network + Azure errors as typed `CrmAuthError`.
- **`soap-client.ts`** — builds SOAP 2011 envelopes (template-string
  approach, same as the PHP), executes via `fetch` with a 90-second
  timeout (matches PHP). Detects `<s:Fault>` and Dynamics JSON error
  envelopes; throws the right typed error. Returns raw response XML so
  operation-specific parsers can extract just what they need.
- **`xml-helpers.ts` / `types.ts`** — minimal entity shapes; only
  `SkateCanadaSeason` for 6.1, more added as 6.2-6.5 light up.
- **`client.ts`** — `SkateCanadaClient` class with `getSeasons(date?)`
  as the proof-of-life operation (mirrors PHP `SkateCanadaApi::getSeasons`).
  Hits the `RetrieveMultiple` request with a `sc_season` fetch query
  filtered to active rows whose `sc_enddate >= date`. Parses the
  Dynamics `EntityCollection` shape into typed objects.

**Tests** (`__tests__/oauth.test.ts`, `soap-client.test.ts`,
`client.test.ts`): cover token caching + expiry + Azure errors,
envelope shape + Fault detection + JSON-error detection, and
end-to-end `getSeasons` parsing against fixture XML.

**Known limitation** (same as Phase 4.2 + 3.1a): vitest 4 + rolldown
darwin-arm64 binding is broken locally; tests parse and typecheck
cleanly, CI exercises them.

**What's NOT in 6.1:**

- High-level operations beyond `getSeasons` — those drop into
  `client.ts` in phases 6.2 (contact + member-number sync), 6.3
  (createMemberRegistration), 6.4 (checkParticipantSeasons), 6.5
  (checkCategories).
- Live smoke test against the Skate Canada test tenant — requires a
  fresh `client_secret` (the secret stored in
  `uplifter/source/uCode.ini` expired 2026-04-03). Operator needs to
  generate a new secret in Azure AD and drop it into Twizzle's `.env`.
- Multi-instance token cache (Redis-backed). In-process Map is fine for
  the single-Node-worker case; sharing across instances is a future
  task if traffic warrants it.

**Reference:** legacy PHP at
`uplifter/source/classes/CrmSoap.class.php` +
`uplifter/source/classes/SkateCanada/SkateCanadaApi.class.php`.

---

### Phase 4.3b — Planned-program builder UI (element picker + row actions)

Layers the interactive builder on top of the 4.3a foundation. The viewer
page is now an editor: pick elements from the catalog, toggle the
second-half flag, reorder, and remove inline.

**New component — `<ElementPicker>`** (`src/components/planned-programs/element-picker.tsx`)

- Side-panel Sheet triggered by an **Add element** button on the program
  page header.
- Tabs by element kind: Jumps · Spins · Steps · Chor · Throws · Lifts · DSpirals.
- Search input filters by code or readable name (case-insensitive
  substring), so `3T` and `triple toe` both find Triple Toe Loop.
- Click an element row → `POST /api/planned-programs/[id]/elements`.
  Toast on success. **Sheet stays open** so the coach can add several
  elements without re-opening.

**Viewer page upgraded to editor** (`src/app/dashboard/athletes/[id]/programs/[programId]/page.tsx`)

- Element rows gain three actions:
  - **2nd-half checkbox** — toggles `inSecondHalf`; PATCHes the element
    and applies optimistically so the total updates instantly.
  - **Up / down arrows** — single-position reorder. Builds the new
    `elementIds` order and POSTs the bulk-reorder endpoint; first/last
    row's buttons are disabled.
  - **Trash button** — DELETE the element. Server compacts remaining
    positions; client re-fetches.
- Total BV recomputes live as the user adds, toggles, or removes elements
  (with the +10% second-half multiplier).

**Out of scope (4.3c — polish):** drag-and-drop reorder (the up/down
arrows cover the same need with less complexity for now), copy a
program from another athlete, ISU constraint validation (max 7 jumps
in a short program, etc.), print/export.

---

### Phase 4.3a — Planned-program data model + APIs + viewer

Foundation for the planned-program builder. Schema, full CRUD API, a
minimal viewer page, and a new "Planned routines" tab on the athlete
detail page. The interactive builder (element picker, drag-drop reorder,
second-half toggle UI) is the 4.3b follow-up.

**New Prisma models:**

- `PlannedProgram` — org-scoped, athlete-scoped. Fields: `name`,
  `discipline?`, `category?`, `notes?`, `createdById`, timestamps.
- `PlannedProgramElement` — ordered child rows. `position` (1-based,
  unique per program), snapshot of the catalog row (`elementCode`,
  `elementName`, `elementKind`, `baseValue`), per-element flags
  (`inSecondHalf`, `notes`). The snapshot keeps a program durable if
  the static ISU_ELEMENTS catalog (from Phase 4.1) ever drifts.

Migration: `20260601195228_add_planned_program`.

**API routes** (ADMIN-only via the existing org-membership gate):

- `GET /api/athletes/[id]/planned-programs` — list programs for the
  athlete with each element's kind + baseValue + inSecondHalf for the
  summary cards.
- `POST /api/athletes/[id]/planned-programs` — create an empty program.
- `GET /api/planned-programs/[id]` — full detail with ordered elements,
  athlete summary, creator.
- `PATCH /api/planned-programs/[id]` — update name / discipline / category / notes.
- `DELETE /api/planned-programs/[id]` — cascades to elements.
- `POST /api/planned-programs/[id]/elements` — append (or insert at
  position) a new element. Looks up the catalog by `elementCode` and
  snapshots name/kind/baseValue. Two-pass position shift to avoid the
  `(programId, position)` unique constraint.
- `PATCH /api/planned-programs/[id]/elements` — bulk reorder. Body is
  `{ elementIds: string[] }` in the new desired order; server rejects
  if the payload doesn't list every element exactly once.
- `PATCH /api/planned-programs/[id]/elements/[elementId]` — edit
  per-element `inSecondHalf` / `notes`.
- `DELETE /api/planned-programs/[id]/elements/[elementId]` — remove +
  compact remaining positions.

**UI:**

- New tab on the athlete detail page: **Planned routines**. Lists
  programs as cards with element-kind counts, computed total base
  value (including the ISU 2nd-half +10% bonus where applicable), and
  "Updated X ago". "New program" dialog creates an empty program.
- Viewer page at `/dashboard/athletes/[id]/programs/[programId]` shows
  the program header, totals strip (BV + per-kind counts), and a
  read-only elements table with the multiplier and per-row total.
  Delete + Back navigation. Empty state notes that element-picking
  arrives in 4.3b.

---

### Phase 3.1b — Athlete merge UI

Wires the Phase 3.1a server-side merge into the admin UI.

**Athletes list page (`/dashboard/athletes`)**

- When exactly two rows are selected (via the existing select-column
  checkboxes), a **Merge selected** button appears in the toolbar between
  the view-mode toggle and the column-visibility menu.
- Clicking it opens a two-step dialog (`<MergeAthletesDialog>`):
  - Step 1 — choose survivor: two side-by-side cards with name + email +
    level/status/federation badges, a radio to pick which one to keep,
    and an optional free-text reason.
  - Step 2 — review: calls `POST /api/athletes/merge/preview`, renders the
    per-table rebound/deduplicated counts, any warnings (e.g. both sides
    have a federation number), and the federation-number decision.
  - On confirm: calls `POST /api/athletes/merge`, shows a sonner toast
    naming the survivor + duplicate, clears row selection, re-fetches
    the list, and navigates to the survivor's detail page.

**Athlete detail page (`/dashboard/athletes/[id]`)**

- New **Merge history** tab (rightmost) showing every merge in which this
  athlete was the survivor: who initiated it, when, the optional reason,
  the duplicate's snapshot (name + level + federation badge), and a
  per-relation count summary.
- Data source: new `GET /api/athletes/[id]/merges` route, ADMIN-only.

**New files:**

- `src/components/athletes/merge-athletes-dialog.tsx`
- `src/components/athletes/merge-history.tsx`
- `src/app/api/athletes/[id]/merges/route.ts`

**Out of scope (still):**

- Cross-organization merges (the API still refuses these — flagged in 3.1a).
- Auto-suggest "likely duplicates" by name/email/birthdate match — that's
  a separate detection feature.

---

### Phase 3.1a — Athlete merge service (server-side)

Server-side primitives for merging duplicate athlete records within an
organization. The UI is a follow-up (3.1b); this commit ships the schema,
service, two API routes, and a unit-test file.

**New Prisma model — `AthleteMerge`**

An append-only audit row, one per merge. Carries the duplicate's snapshot
(Athlete + OrganizationAthlete fields, serialized as Json) so the merge is
inspectable even after the duplicate row is gone. Also stores per-table
`counts` (`{ rebound, deduplicated }`), `survivorId`, `mergedById`, optional
`reason`, and an `organizationId` scope. Cascades on Organization delete and
Athlete (survivor) delete. Migration: `20260601185655_add_athlete_merge`.

**Service — `src/lib/athlete-merge.ts`**

- `previewMerge(input)` — returns per-table counts of what would be rebound vs.
  deduplicated, plus warnings (e.g. both sides have a federation number), plus
  the federation-number decision (which row's number will survive and why).
  Doesn't mutate anything.
- `executeMerge(input)` — runs the merge in a single `db.$transaction`:
  1. Validate (same org, no cross-org leakage, no non-DRAFT FederationSubmission
     on the duplicate, both athletes exist).
  2. Rebind 16 plain-FK tables via `updateMany` (Attendance, Evaluation,
     CompetitionEntry/Result, RegistrationFile, Media, LineItem,
     RecurringCharge, GuardianClaimRequest, Enrollment, AthleteMembership,
     AthletePass, WaiverAcceptance/Signature, InstanceAttendance/Registration).
  3. Rebind 4 dedup-keyed tables (AthleteGuardian/userId,
     AthleteSkillProgress/skillId, CustomInfoResponse/questionId,
     AthleteAchievement/achievementId) — survivor's existing key wins, duplicate's
     row dropped on conflict, rebound otherwise.
  4. Handle the 1:1 AthleteMedicalInfo (survivor keeps theirs).
  5. Handle FederationSubmissionAthlete specially (composite PK; delete +
     create rather than update).
  6. Merge the OrganizationAthlete join row — federation fields come from the
     row with the OLDER `createdAt` (per ROADMAP "preserve the oldest
     federationMemberNumber"), other fields prefer the survivor's.
  7. Write the `AthleteMerge` audit row with snapshot + counts.
  8. Delete the duplicate Athlete row.
- `MergeValidationError` thrown when preconditions fail; carries an `errors[]`
  array for the API to surface.

**API routes**

- `POST /api/athletes/merge/preview` — ADMIN-only. Returns the preview result.
- `POST /api/athletes/merge` — ADMIN-only. Executes; returns `{ mergeId, counts }`
  on success or `{ error, errors }` with 400 on validation failure.

**Tests — `src/lib/__tests__/athlete-merge.test.ts`**

Unit tests against the auto-mocked Prisma client covering: self-merge refusal,
missing athletes, cross-org refusal, non-DRAFT submission refusal, federation
decision rules, audit-row write + duplicate-delete on success.

**Known environment limitation:** vitest 4 + rolldown has a broken native
binding on darwin-arm64 (`@rolldown/binding-darwin-arm64`). Tests parse and
typecheck cleanly; they'll run in CI but fail to start locally with the
current pnpm install. The service was also runtime-verified against the live
local DB via a one-shot integration script (not committed): two fresh
athletes were created in the seeded Sunrise org, a Federation rule + Evaluation
were attached to the duplicate, executeMerge ran successfully, and all
expected post-conditions held (federation number transferred to survivor,
evaluation rebound, audit row written, duplicate deleted).

**Out of scope (3.1b — next session):**

- Athletes-list UI multi-select + merge action
- Confirm dialog rendering the preview output
- "Merge history" tab on the athlete detail page

---

### Login page polish: slower fades + no theme toggle

- **Video background fade-in** set to **1500 ms** (`fadeInMs={1500}` on the
  `<VideoBackground>` instance in `src/app/(auth)/login/page.tsx`). Revised
  down from the initial 3000 ms after a quick visual review.
- **Video background loop fade-out** bumped 4000 ms → **6000 ms**
  (`loopFadeMs={6000}` on the same instance). The dip at the loop boundary
  is now noticeably gentler.
- **Theme toggle removed from all `(auth)` pages** — login, forgot/reset
  password, accept-invitation, switch-organization, organization-deactivated,
  find-your-club. Removed the `<AnimatedThemeToggler />` from
  `src/app/(auth)/layout.tsx`. Component defaults (2000/4000) are unchanged,
  so other `<VideoBackground>` usages keep the original timing.

**Caveat:** the toggle was previously _only_ on the auth/pre-login pages +
some public-facing surfaces (sites layout, org-signup, feedback, POS
org-select, site-header). It is NOT currently present in the authenticated
`/dashboard`, `/coach`, or `/superadmin` surfaces. Adding it back into
the dashboard is a separate follow-up if you want theme-toggling inside
the app.

---

## 2026-05-30

### Phase 5.4 UI — SkateCanadaSeason admin UI

SUPERADMIN-only management UI for global `SkateCanadaSeason` records (model
added in Phase 5.4 schema work).

**New page — `src/app/superadmin/skate-canada-seasons/page.tsx`**

- Table listing all seasons ordered by start date (newest first), with columns:
  Name, Start date, End date, Active badge (green / muted), CRM GUID (truncated
  or "— not synced"), and Actions.
- **New season** button + Edit button open a Sheet with a create/edit form
  (name, start date, end date, isActive switch, scSeasonGuid).
- **Set as active** button (inactive seasons only) calls the activate endpoint
  atomically (deactivates all others in a `$transaction`).
- `EmptyState` with `Calendar` icon when no seasons exist.

**New API routes — `src/app/api/superadmin/skate-canada-seasons/`**

- `GET /` — list all seasons ordered by `startDate DESC`.
- `POST /` — create season; atomic deactivate-all + create when `isActive: true`.
- `PATCH /[id]` — update season; atomic switcheroo when flipping `isActive` true.
- `POST /[id]/activate` — dedicated activate endpoint used by the "Set as active" button.

**Nav / command palette**

- `SuperadminSidebar` (`src/components/superadmin-sidebar.tsx`): "Skate Canada
  Seasons" entry added above "Competition Categories".
- Command palette (`src/components/command-palette.tsx`): `SUPERADMIN_NAV`
  array added (visible to `isSuperAdmin` users); includes the seasons page.

---

### Phase 0.7 (batch 2) — Empty states on 3 more list pages

Replaces bare plain-text empty branches with `<EmptyState>` on:

- **Competitions** (`/dashboard/competitions`) — Trophy icon; action links to `/dashboard/competitions/new`; search-filtered state shown without action.
- **Invoices** (`/dashboard/financials/invoices`) — Receipt icon; no action (invoices are system-generated).
- **Announcements** (`/dashboard/communication/announcements`) — Megaphone icon; action opens the New Announcement dialog; filtered state shown without action.

Skipped (paths not present in repo): `registrations/memberships`, `registrations/queue`.

---

### Wire CREATED audit event on federation submission create

The `POST /api/federation-submissions` handler now calls `logFederationSubmissionEvent`
with `eventType: "CREATED"` inside the existing `$transaction`, immediately after the
`FederationSubmission` row and its athlete links are inserted. The event records the
federation name and athlete count, and is attributed to the creating user. The audit log
timeline on the submission detail page will now show a CREATED entry as the oldest event.

---

### chore: Remove OrgSport dead code from Skills page

Commit B (Sport-model deletion) deleted the `OrganizationSport` model and the
`/api/organization/sports` endpoint but left behind client-side references in
the Skills page that caused a silent 404 on every page load. Removed the
`OrgSport` interface, `orgSports` state, `loadOrgSports` fetch + `useEffect`
call, and the sport-badge strip rendered in the page header description.

---

### Phase 0.7 (partial) — Empty-state component + 4 list pages

New reusable `EmptyState` component (`src/components/ui/empty-state.tsx`) with
icon halo, title, optional description, and optional action button/link. Replaces
bare "No results" text on four list pages:

- **Athletes** (`/dashboard/athletes`) — table view and grid view; action opens
  the Add Athlete dialog.
- **Programs** (`/dashboard/registrations/programs`) — zero-programs state; action
  links to `/dashboard/registrations/programs/new`.
- **Evaluation templates** (`/dashboard/training/evaluations`) — Templates tab
  zero-state; action opens the New Template sheet.
- **Federation submissions** (`/dashboard/federation-submissions`) — replaces the
  Phase 5.2 placeholder; action links to `/dashboard/federation-submissions/new`.

Inline-edit affordances are out of scope for this commit (separate task).

---

### Phase 0.2 — Optimistic UI on athlete + evaluation template edits (partial)

Applies the snapshot → optimistic-update → reconcile → rollback pattern to two
high-frequency mutations:

- **Athlete edit save** (`src/hooks/use-athletes.ts`): `updateAthlete()` now
  applies scalar fields immediately to the list, awaits the PATCH in the
  background, then reconciles with the server response. On network failure the
  list reverts to the pre-edit snapshot.
- **Evaluation template save** (`src/app/dashboard/training/evaluations/page.tsx`):
  `handleUpdate()` applies flat field changes to the cards immediately, closes
  the Sheet, then awaits `PUT /api/evaluation-templates/:id`. On failure the
  card list reverts and a toast error is shown.

No new dependencies or shared abstractions introduced.

---

### New federation-submission form page

Adds the missing "create" entry-point for `FederationSubmission` rows. The
queue page's empty-state CTA and header button both link to this page.

**New page — `src/app/dashboard/federation-submissions/new/page.tsx`**

- ADMIN-only client component (enforced server-side by the POST route).
- **Federation selector** — shadcn `Select` defaulting to `SKATE_CANADA`.
- **Athletes multi-select** — `Command`/`Popover` combobox pre-fetching all org
  athletes on mount. Selected athletes shown as removable `Badge`s below the
  trigger.
- **Payload editor** — monospace `Textarea` (12 rows) pre-filled with `{}\n`.
  Inline validation error shown if the value is not valid JSON on submit.
- **Create draft** button disabled until ≥1 athlete selected and payload is
  valid JSON. On success: sonner toast + redirect to the new submission detail
  page.

**New handler — `POST /api/federation-submissions`**

- Validates body with zod: `federation`, `athleteIds` (min 1), `payload`.
- Verifies all athleteIds belong to the admin's org via `OrganizationAthlete`;
  returns `400` on mismatch.
- Creates `FederationSubmission` (`status: DRAFT`) + `FederationSubmissionAthlete`
  join rows inside a `$transaction`.
- Returns `201` with the created submission object.

**Command palette** — "New federation submission" action added to the Actions
group (ADMIN-only), navigates to `/dashboard/federation-submissions/new`.

---

### Phase 5.2 + 5.3 integration — audit log wired into submission detail page and transitions

The Phase 5.3 `FederationSubmissionAuditLog` component now renders on the Phase 5.2
submission detail page, replacing the placeholder stub. The Phase 5.2 transitions endpoint
wraps its `federationSubmission.update` call in a `$transaction` and calls
`logFederationSubmissionEvent` with `STATUS_TRANSITIONED` inside the same transaction,
making the status update and audit row atomic. No schema changes; both phases were
already on main.

---

### Appendix A Commit B — drop Sport / SportEvent / SportAgeCategory / OrganizationSport / SportEventEligibility

Skating-only rebrand cleanup (pre-authorized 2026-05-27). Removes all
multi-sport scaffolding from schema and source.

**Schema:** deleted 5 models (`Sport`, `OrganizationSport`, `SportEvent`,
`SportAgeCategory`, `SportEventEligibility`), removed `Organization.sports`
inverse relation, dropped `sportId` FK from `CompetitionCategoryTemplate`,
dropped `sportEventId`/`ageCategoryId` FKs from `CompetitionCategory`.

**API routes deleted:** `POST/GET /api/organization/sports`,
`/api/sports/[sportId]/*`, `/api/superadmin/sports/**` (6 routes).

**Pages deleted:** `/superadmin/sports`, `sport-filter.tsx`.

**Pages refactored:** `/superadmin/competition-categories` (sport selector
removed; templates now managed without sport grouping),
`/superadmin/organizations/[slug]` (sports card removed),
`/dashboard/organization/overview` (sports card removed),
competition stepper + categories/events/results pages (sport-specific
event/age-category combinator removed).

**Seed:** removed athletics sports block, org-sport associations, and
sport-specific event/age-category/eligibility seed data from `seed-dev.ts`.

---

## 2026-05-29

### Phase 5.3 — Submission audit log (append-only events)

Adds a full append-only audit log to `FederationSubmission`. Every meaningful
change to a submission writes one immutable row; rows are never updated or
deleted.

**New Prisma model — `FederationSubmissionEvent`**

- `eventType` (`FederationSubmissionEventType` enum) — one of `CREATED`,
  `PAYLOAD_UPDATED`, `ATHLETE_ADDED`, `ATHLETE_REMOVED`, `STATUS_TRANSITIONED`,
  `EXTERNAL_REF_SET`, `RESOLUTION_NOTE_SET`, `NOTE_ADDED`.
- `data Json?` — optional structured payload. `STATUS_TRANSITIONED` events
  carry `{ previousStatus, nextStatus }`; payload edits carry a diff.
- `note String?` — optional free-text comment from the actor (e.g. rejection
  reason).
- `actorId String?` — nullable so system-generated events are representable.
- `createdAt DateTime` — insert-only timestamp; no `updatedAt`.
- Composite index on `(submissionId, createdAt)` for efficient timeline fetches.
- Single index on `eventType` for analytics queries.
- `onDelete: Cascade` from `FederationSubmission` so events clean up
  automatically when a submission is deleted.
- Inverse relations wired on `FederationSubmission` (`events`) and `User`
  (`federationSubmissionEvents @relation("FederationSubmissionEventActor")`).

**Migration** — `prisma/migrations/20260529200000_add_federation_submission_event/migration.sql`

**Write helper — `src/lib/federation-submission-audit.ts`**

Exports `logFederationSubmissionEvent({ submissionId, eventType, data, note,
actorId, prismaClient? })`. Accepts an optional `Prisma.TransactionClient` so
callers can batch the audit row into their own transaction.

**API endpoint — `GET /api/federation-submissions/[id]/events`**

ADMIN-only, org-scoped (verifies the submission belongs to the requesting
admin's org). Returns events ordered by `createdAt DESC` with actor
`{ id, name, email, avatar }` included.

**Component — `src/components/federation-submissions/audit-log.tsx`**

`<FederationSubmissionAuditLog submissionId={…} />` (client component). Fetches
from the new endpoint, renders a vertical timeline with actor avatar, friendly
event label, `date-fns` relative time, optional note block, and `old → new`
status annotation for `STATUS_TRANSITIONED` events. Loading state uses
`<Skeleton>` strips; empty state shows "No events yet."

Phase 5.2 (admin submission queue page) will wire this component into the
submission detail view after both routines land.

---

### Phase 5.2 — Admin submission queue page

New ADMIN-only pages and API routes for managing `FederationSubmission` rows
(created in Phase 5.1).

**List page** at `/dashboard/federation-submissions`: TanStack-table view of all
submissions for the current org. Columns: Federation badge, Status badge,
Athletes count, Created by, Submitted at, Resolved at, External ref, and
Actions. Supports multi-select Status filter and single-select Federation filter.
Action buttons are role-aware: DRAFT rows show "Mark Submitted" + "Edit"; SUBMITTED
rows show "Mark Accepted" + "Mark Rejected" (each opens a confirmation dialog with
an optional `resolutionNote` field). ACCEPTED/REJECTED rows are read-only.

**Detail page** at `/dashboard/federation-submissions/[id]`: shows status badge,
lifecycle timestamps with actor names, linked athletes (name + level badge),
raw `payload` JSON viewer, `resolutionNote` if present, and a stub audit-log
section (Phase 5.3). Same transition actions as the list page.

**API routes** under `src/app/api/federation-submissions/`:

- `GET /` — list submissions, filterable by `status` and `federation`.
- `GET /[id]` — single submission with athletes and actor relations.
- `POST /[id]/transitions` — enforce valid transitions (DRAFT→SUBMITTED,
  SUBMITTED→ACCEPTED|REJECTED). Sets `submittedAt`/`resolvedAt` and the
  corresponding actor ID. Returns 400 on invalid transition.

All routes are ADMIN-only. Nav wired in sidebar (Federation → Submissions) and
command palette (Federation Submissions).

---

### Phase 2.1 — Bulk achievement CSV import

New page at `/dashboard/training/import-achievements` and API route
`POST /api/training/import-achievements` allowing ADMIN users to upload a CSV
file and bulk-create `Evaluation` records for their athletes.

CSV format (four required headers, any column order):

```
athlete_id,skill_name,date_earned,notes
```

Each valid row creates one `Evaluation` linked to the athlete and the matching
`EvaluationTemplate` (matched by name, case-insensitive). Rows with an unknown
athlete ID, unknown template name, or invalid date are skipped and returned with
a reason in the API response. The page shows a summary card with created count
and the first 10 skipped rows after each import.

Defaults applied to every imported row: `status: "PASS"`,
`overallScore: 0`, `coachId: <importer's user id>`. Sidebar nav link
to the new page is wired up in this commit.

---

### Fix: Skills page first-render default categories

`/dashboard/training/skills` briefly flashed gymnastics apparatus
categories (Floor / Bars / Beam / Vault / Trampoline / General) before
the `/api/skills` response replaced them with the org's actual
categories. The flash was a leftover from the pre-2026-05-27 multi-sport
codebase.

Replaced the `DEFAULT_CATEGORIES` constant with a skating-aligned list:
Skating Skills, Jumps, Spins, Step Sequences, Choreography, Off-Ice,
General. Matches Skate Canada's StarSkate skill-area structure and acts
as a placeholder until the API returns the org's persisted categories.

---

### Phase 5.4 — SkateCanadaSeason data model

New global `SkateCanadaSeason` Prisma model for tracking Skate Canada's annual
seasons (roughly Sept 1 → Aug 31). Added to `prisma/schema.prisma` and
migrated in `20260529190000_add_skate_canada_season`.

Key fields:

- `name` — unique human-readable label (e.g. `'2026-2027'`)
- `startDate` / `endDate` — official season window
- `isActive` — flag for the current registration season (at-most-one enforced by app code)
- `scSeasonGuid` — nullable; Phase 6.4 will sync from Skate Canada CRM API

Foreign-key references (`skateCanadaSeasonId String?`) added to:

- `Competition` — every competition belongs to a Skate Canada season
- `Program` — programs are season-scoped for registration / fee rules
- `MembershipGroup` — membership groups align to a season for eligibility

All FKs are nullable (no backfill required; existing rows remain unassigned).
Dev seed: `seedSkateCanadaSeasons()` in `prisma/skate-seed.ts` upserts the
`2026-2027` season with `isActive: true` and `scSeasonGuid: null`.

---

### Phase 5.1 — FederationSubmission model

Adds the `FederationSubmission` Prisma model (and join table `FederationSubmissionAthlete`) tracking the full lifecycle of an org's athlete-data submission to a skating federation.

- **New enum `Federation`:** `SKATE_CANADA | USFS | ISU` — identifies the target federation.
- **New enum `FederationSubmissionStatus`:** `DRAFT | SUBMITTED | ACCEPTED | REJECTED` — lifecycle states.
- **`FederationSubmission` model:** org-scoped, stores a flexible `Json` payload (federation-specific shape defined per integration), lifecycle timestamps (`submittedAt`, `resolvedAt`), optional `externalRef` and `resolutionNote`, and three actor FKs (`createdById`, `submittedById`, `resolvedById`).
- **`FederationSubmissionAthlete` join table:** composite PK `(submissionId, athleteId)` — many-to-many between submissions and athletes.
- **Inverse relations** wired on `Organization` (`federationSubmissions`), `User` (`createdSubmissions`, `submittedSubmissions`, `resolvedSubmissions`), and `Athlete` (`federationSubmissions`).
- **Migration:** `prisma/migrations/20260529180000_add_federation_submission/migration.sql`.

No UI or API routes in this phase — see Phase 5.2 (queue page) and 5.3 (audit log). Verification steps in [TESTING.md](./TESTING.md).

---

### Phase 0.8 — Power-user keyboard shortcuts

Global shortcuts mounted alongside `CommandPaletteProvider` in the admin and
coach layouts via a new `KeyboardShortcutsProvider` client component:

- **`?`** — opens a `Dialog` listing every shortcut grouped by Navigate / List
  page / Misc.
- **`g` → letter** — vim-style sequenced navigation (1.5 s window): `g a`
  athletes, `g p` programs, `g c` competitions (admin only), `g s` settings.
  Uses the same subdomain-routing pattern as the command palette.
- **`Escape`** — Radix `Dialog`, `Sheet`, and `Popover` already dismiss on
  Escape; no custom handling needed.

List-page shortcuts (`/dashboard/athletes`, `/coach/athletes`,
`/dashboard/registrations/programs`, `/coach/programs`):

- **`j` / `k`** — move a highlighted ring down / up through the visible rows or
  cards. Defaults to the first item.
- **`Enter`** — navigates to the highlighted row's detail page.
- **`e`** — opens the row's edit sheet (admin athletes) or quick-configure
  panel (admin programs); no-op on coach-only pages that lack edit affordances.
- **`d`** — opens the row's delete confirmation (admin athletes only).

All shortcuts are guarded: no-op when an `input`, `textarea`, `select`,
`contentEditable`, or any Radix dialog/sheet has focus. No animated
transitions beyond the existing ring from Phase 0.5.

New files: `src/hooks/use-global-shortcuts.ts`,
`src/hooks/use-list-keyboard-shortcuts.ts`,
`src/components/keyboard-shortcuts-provider.tsx`.

---

### Phase 4.1 — ISU element catalog seed

New static data module `prisma/isu-elements.ts` — a typed, zero-DB-write
catalog of 116 canonical ISU figure-skating elements.

- **Jumps (24):** all 6 types (T, S, Lo, F, Lz, A) × 4 rotations
  (single through quadruple), including 4A.
- **Spins (50):** 10 families (USp, SSp, LSp, CSp, CoSp + flying
  variants FUSp, FSSp, FLSp, FCSp, FCoSp) × 5 levels (B / 1-4).
- **Step sequences (6):** StSqB–StSq4 plus ChSq1.
- **Death spirals (20):** all 4 entry directions (FoI, FoO, BoI, BoO)
  × 5 levels.
- **Lifts (10) + Throw jumps (6):** representative pairs sample;
  additional groups wired in Phase 4.3.

Exports `IsuElement` interface and `ISU_ELEMENTS` constant. No Prisma
schema changes. Phase 4.3 (planned-program builder) will persist rows.

---

### Phase 0.3 — Bento-grid dashboard (Coach)

The Coach dashboard "Overview" section is no longer a row of four equal
stat cards. It's now a Bento grid: a large hero "Today" tile (2×2)
flanked by four small KPI tiles (Attendance, Programs, Competitions,
This week). Each tile lifts on hover (2px) and most are clickable
links to their respective sections.

- **New primitive:** `src/components/ui/bento.tsx` exporting
  `<BentoGrid>` (responsive 2/3/4/6-col grid, fixed 10rem auto-rows on
  md+) and `<BentoTile>` (CSS `col-span` / `row-span` props, hover lift
  via `motion-safe:hover:-translate-y-0.5 hover:shadow-md`,
  `asChild` via Radix `Slot` so tiles can render as `<Link>` while
  keeping their shadow + lift styling on the outer element).
- **Coach dashboard rewrite** (`src/app/coach/page.tsx`): "Overview"
  block now renders `<BentoGrid cols={4}>` with a `colSpan=2 rowSpan=2`
  hero tile + four `colSpan=1` KPI tiles. The redundant bottom
  "This week summary" card was removed (its data lives in the bento KPI now).
- **Out of scope for this drop:** Admin dashboard (already a thoughtful
  2-col layout with ActionItemsPanel + ProgramCalendar — no "equal
  cards" problem to solve) and athlete-profile bento (108KB page with
  internal tab structure, separate sprint).

### Phase 0.4 — FLIP layout transitions on the Athletes list

The Athletes list (`/dashboard/athletes`) gained a table ↔ card-grid
view toggle. Switching modes morphs each athlete's avatar+name pair
along a curved path from its table-row position to its card position
(and back), using Framer Motion's `layoutId` shared between the two
renders.

- **Toggle:** `<ToggleGroup>` with `List` / `LayoutGrid` lucide icons,
  placed next to `DataTableViewOptions` in the table toolbar. View mode
  is local component state (resets on page reload — fine for now).
- **FLIP plumbing:** both views wrap each athlete's avatar+name region
  in `<motion.div layoutId={`athlete-${id}`} layout="position">`. A
  single `<LayoutGroup>` wraps both branches so layout IDs cross the
  view-mode boundary. `transition={{ duration: 0.3, ease: "easeOut" }}`.
- **Accessibility:** `useReducedMotion()` flips `layout` to `false`
  when the user's OS prefers reduced motion, skipping the animation
  entirely.
- **Filtering/sorting/pagination still apply** in grid mode — the grid
  iterates `table.getRowModel().rows` exactly like the table body did.
- **Out of scope for this drop:** Programs list (would duplicate the
  same pattern) and the list-row → detail-page header morph (Next.js
  route navigation breaks `layoutId` continuity — needs View
  Transitions API + cross-route shared-element work).

---

### Phase 4.2 — ISU shorthand abbreviation generator

New pure-function library `src/lib/isu-shorthand.ts` that converts
structured element inputs into canonical ISU/Skate Canada shorthand
codes. No Prisma, no React — safe on both client and server. Intended
as the encoding layer for the Phase 4.3 planned-program builder.

- **`generateIsuShorthand(input: IsuElementInput): string`** — exhaustive
  discriminated-union switch with a TypeScript `never` guard so missing
  cases are caught at compile time.
- **Element kinds covered:** single jumps, jump combinations, all 10 ISU
  spin families (USp / SSp / LSp / CoSp / FSSp / FCoSp / FUSp / FLSp /
  FCSp / CSp), step sequences, choreographic sequence (`ChSq1` fixed),
  spiral sequence (`SpSq` fixed), death spirals (4 entry-edge variants),
  10 lift families (Pairs + Ice Dance), and throw jumps.
- **Levels:** B (basic) and 1–4 on every levelled element.
- **Jump combinations:** `+`-separated, e.g. `3F+2T+2Lo`. Empty elements
  array returns `""` (documented; callers must guard if an error is needed).
- **63 vitest cases** in `src/lib/__tests__/isu-shorthand.test.ts` covering
  every element kind, level, and the empty-combo edge case.

---

### Shorthand search on the Evaluations page + searchable Level dropdown

The evaluations templates list (`/dashboard/training/evaluations`)
search input now matches CanSkate ribbon and STAR shortcuts (`cs3`,
`star5`, `precs`) the same way the New-evaluation template picker
does. The same shorthand vocabulary now also powers a new searchable
Level dropdown in the Create / Edit template sheets — previously a
plain Select with no search.

- New shared helpers in `src/lib/evaluation-search.ts`:
  `levelSearchKeywords(name)`, `templateSearchKeywords(template)`,
  `matchesQuery(keywords, query)`. AND-tokenized substring match
  across name + ribbon meta + STAR-pattern derivation. Same matching
  semantics as `TemplatePicker`.
- Evaluations page: stopped sending `?search=` to the API. Fetches
  the full template set once and filters client-side via
  `matchesQuery(templateSearchKeywords(t), query)`. Drops the 300 ms
  debounce — search is instant now. New "no matches" empty state
  hints at `cs3` / `star5` style keywords.
- New `<LevelCombobox>` (`src/components/evaluations/level-combobox.tsx`)
  — below 8 options falls back to a plain Select; above, it's a
  Popover + cmdk Command with the same shorthand-aware filter.
  Replaces the Level Select in both Create and Edit sheets.

---

### Fix: UplifterIcon overflowing the login card

`<UplifterIcon>` was rendered with `width="auto"`, which isn't a valid
SVG attribute. Browsers fell back to the viewBox width (186 px), so
the icon claimed ~186 px instead of the ~48 px it should at
`height={36}`. Combined with `shrink-0` it couldn't compress, and
pushed "Twizzle" past the Card's 400 px boundary.

Fix: compute the width explicitly from the icon's intrinsic aspect
ratio (`186 / 141 ≈ 1.319`) and pass it as a numeric `width` prop.
At `height={36}` the SVG is now a definite 47 px wide.

---

### Login refresh round 3 — even slower video fade, capital-T wordmark + icon, 1.5s theme switch

Three small polish passes after round 2:

- **Video loop fade-out** bumped 2000 ms → **4000 ms** (default
  `loopFadeMs` on `<VideoBackground>`). The dip at the loop boundary
  is now obviously slower — useful when the source clip has
  noticeable motion at its start/end frames.
- **TwizzleWordmark** now renders **"Twizzle"** (capital T, was
  lowercase) and prepends the legacy purple Uplifter icon — the
  balloon/heart symbol extracted from `/public/uplifter-logo.svg`
  into a new `<UplifterIcon>` primitive. Both pieces share
  `text-primary` so they stay in sync with the theme.
- **`AnimatedThemeToggler`** default `duration` raised from 400 ms →
  **1500 ms**. The clip-path reveal that fires when you toggle
  light/dark now sweeps across the screen at a noticeably more
  cinematic pace. Every callsite that didn't override the prop
  picks this up automatically.

---

### Login refresh round 2 — slower fades, no grid, soft buttons, wordmark, twizzle.localhost

Follow-ups to the earlier login-page reskin per design feedback:

- **Video fade timing** bumped 800 ms → **2000 ms** on both the
  mount fade-in and the per-loop opacity dip. The seam between
  loops is now imperceptible at the cost of a slightly longer
  initial reveal.
- **Subtle grid pattern** removed from `GradientBackground` (was
  rendering through the glass card). Affects every auth page — the
  base gradient + orbs still ship.
- **Provider buttons** (Microsoft / Google / Email Code) move from
  the stark `variant="outline"` to a glassy `bg-card/30
backdrop-blur-md border-white/{20,10}` matching the card. Icon
  size bumped from `h-5 w-5` → `h-7 w-7`.
- **"Or continue with" divider** loses its background pill and the
  horizontal rule. Now a plain centered uppercase line: `text-xs
font-bold tracking-wider text-foreground`.
- **New `<TwizzleWordmark>`** primitive replaces `<UplifterLogo>` on
  all three login Card variants (MFA, email-code, credentials).
  Pure CSS text rendering — "twizzle" in `text-primary`, tight
  letter-spacing, scales via a `height` prop. No image asset.
  `UplifterLogo` itself stays in place for other auth pages
  (accept-invitation, organization-deactivated) for now.
- **Local base domain** changed from `uplifter.localhost:3000` →
  `twizzle.localhost:3000`. Hits `src/lib/env-domains.ts` plus 8
  hardcoded runtime references (cookie domains in 3 auth bridge
  routes + `auth-cookies.ts`, fallback strings, middleware
  comments). Production / staging / dev DNS unchanged — those are
  external records. **Cookie impact:** existing `uplifter.localhost`
  sessions are no longer reachable; you'll need to sign in fresh on
  `twizzle.localhost`. Bookmarks pointing at the old subdomain
  return 404.

---

### Login page refresh — video background, glass card, purple titles, Twizzle name

Four-point reskin of the `/login` page:

- **Browser title** in the root `<head>` is now **"Twizzle"** (was
  "Uplifter"); description is "Skating club management for figure
  skaters". Logo image's `alt` text is also "Twizzle".
- **Headings** ("Verify your identity", "Sign in with email", etc.)
  switch from default foreground to `text-primary` — the purple theme
  color (HSL `240 81% 63%`).
- **Background** uses a new `<VideoBackground>` component that plays
  `/public/twizzle_login_background.mp4` on a loop with a gentle
  fade-in on mount and an opacity dip at every loop boundary so the
  seam between repeats is invisible. Respects `prefers-reduced-motion`
  (still plays the video, but skips the per-loop opacity dance).
  Positioned `fixed inset-0` so it covers the auth layout's
  `GradientBackground` only on `/login` — the other auth pages
  (accept-invitation, forgot-password, etc.) keep the gradient.
- **Login card** turns into glass: `bg-card/40 backdrop-blur-xl
border-white/20 dark:border-white/10 shadow-2xl`. The page's
  gradient + video now shows through the modal in both light and
  dark themes.

---

### Fix: Federation Membership Requirement toggle missing from ProgramStepper

Phase 1.2 added the `hasFederationMembershipRestriction` toggle to the
Settings sheet (`ProgramConfiguration`) but missed the parallel
multi-step wizard (`ProgramStepper`) used by the **Edit** flow at
`/dashboard/registrations/programs/[id]/edit` and the new-program
wizard. Mirrors the same four-point wiring — formData type, form
state init, API restore, save payload — and adds the matching Switch
to Step 3 (Requirements) right after File Upload Requirement.

---

### Fix: route users to their actual portal at login + sidebar cross-links

Three connected fixes so a coach logging in lands on the coach portal
(not on the admin portal with the admin sidebar) and so the cross-links
between portals only appear for users who can actually use them.

- **`handlePostLoginRedirect`** (the credentials-flow redirect in
  `src/components/auth/login-form.tsx`) used to hardcode the admin
  subdomain for every successful sign-in. It now fetches the freshly
  signed-in session and routes via a new role-aware
  `getPortalUrlForRole(role, permissions)`:
  - `ADMIN` / `SUPERADMIN` / `*` perm → `admin.<base>/`
  - `COACH` / `coaching.portal` perm → `coach.<base>/`
  - else → `athletes.<base>/`
- **Admin sidebar's "Coach Portal" cross-link** is now gated on the
  caller having `coaching.portal` (or `*`) — pure admins no longer see
  a link that would 403 them.
- **Coach sidebar** gains a new "Other Portals" section with an
  **Admin Dashboard** link, gated on the user actually having admin
  access (`role === ADMIN/SUPERADMIN` or `*` perm). Pure coaches don't
  see it; admins-who-also-coach can hop back without `cmd+L`-typing
  the admin subdomain.

---

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
