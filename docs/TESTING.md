# Twizzle Testing Guide

Manual verification steps for features shipped to `main`. Newest first.
The running list of _what_ shipped lives in [`CHANGELOG.md`](./CHANGELOG.md).

If you fix a bug or ship a feature, add an entry here with concrete
click-by-click verification steps the next reviewer (human or agent)
can follow without re-deriving the intent.

---

## Smoke test — current top of `main`

Run after any large merge to catch regressions early. Start at
**http://login.twizzle.localhost:3000** and log in as an admin (the
seed creates `admin@sunrise-skating.com`; users have email-magic-link
auth — MailHog at http://localhost:8025 catches the link locally).
(Note: the local base domain switched from `uplifter.localhost` to
`twizzle.localhost` — old bookmarks 404.)

### Phase 5.1 — FederationSubmission model

Schema-only change; no UI. Verification is static (no running DB required).

#### Schema validation

1. From the repo root run:

   ```bash
   DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma validate
   ```

   Expected: `The schema at prisma/schema.prisma is valid 🚀`

2. Run `pnpm typecheck` (or `tsc --noEmit`). Expected: exits 0, no errors.

#### Migration SQL spot-check

Inspect `prisma/migrations/20260529180000_add_federation_submission/migration.sql`:

- Two `CREATE TYPE` statements for `Federation` and `FederationSubmissionStatus` enums.
- `CREATE TABLE "FederationSubmission"` with columns: `id`, `organizationId`, `federation`,
  `status` defaulting to `'DRAFT'`, `submittedAt`, `resolvedAt`, `resolutionNote`,
  `payload JSONB`, `externalRef`, `createdById`, `submittedById`, `resolvedById`,
  `createdAt`, `updatedAt`.
- `CREATE TABLE "FederationSubmissionAthlete"` with composite PK
  `("submissionId","athleteId")`.
- Two composite indexes on `FederationSubmission`: `(organizationId, status)` and
  `(federation, status)`.
- One index on `FederationSubmissionAthlete`: `(athleteId)`.
- Six `ADD CONSTRAINT … FOREIGN KEY` statements wiring org, three users, and both
  sides of the join table. `onDelete: CASCADE` on org + submissionId side; `SET NULL`
  on optional user FKs.

#### Prisma Client type spot-check (after `prisma generate`)

In any TypeScript file or REPL:

```typescript
import { Federation, FederationSubmissionStatus } from "@prisma/client";
// Both enum types must be available — TS will error if generation failed.
const f: Federation = Federation.SKATE_CANADA;
const s: FederationSubmissionStatus = FederationSubmissionStatus.DRAFT;
```

#### DB smoke test (requires local Postgres)

Once a local DB is available (Phase 5.2+):

1. Run `pnpm db:migrate` — migration should apply cleanly.
2. In `psql`: `\d "FederationSubmission"` — confirm all columns and constraints.
3. Create a DRAFT submission via Prisma Studio or a seed script, then update
   `status` to `SUBMITTED` and verify `submittedAt` can be set. Repeat for
   `ACCEPTED`/`REJECTED` with `resolvedAt` + `resolutionNote`.

---

### Phase 0.8 — Power-user keyboard shortcuts

#### Global shortcuts (any admin or coach page)

1. Navigate to `/dashboard/athletes`. Click somewhere outside any input so
   no element has focus. Press **?** → a "Keyboard shortcuts" dialog opens
   listing three sections: **Navigate**, **List page**, **Misc**. Press **Esc**
   to close it.
2. From the same page press **g** then **a** within 1.5 s → browser
   stays on (or navigates to) `/dashboard/athletes`.
3. Press **g** then **p** → navigates to `/dashboard/registrations/programs`.
4. Press **g** then **c** → navigates to `/dashboard/competitions`.
5. Press **g** then **s** → navigates to `/dashboard/organization/features`.
6. Press **g**, then wait > 1.5 s, then press **a** → nothing happens (timeout
   aborted the sequence).
7. Focus a search input on any page. Press **?** → dialog does **not** open
   (input guard active).
8. Sign in as a coach (`coach.maria@sunrise-skating.com`). Press **g s** →
   navigates to `/coach` (no settings page for coaches). Press **g c** →
   nothing happens (competitions shortcut is admin-only).

#### List-page shortcuts — admin athletes (`/dashboard/athletes`)

1. Navigate to `/dashboard/athletes`. Ensure at least 3 athletes are visible.
2. Click the page background (no input focused). The **first row** has a
   ring/border highlight indicating it is selected.
3. Press **j** → highlight moves to the second row. Press **j** again →
   third row. Press **k** → back to second row.
4. Press **j** twice more (now on the fourth row if it exists, or stays at
   the last row). Press **Enter** → browser navigates to
   `/dashboard/athletes/<id>` for that athlete.
5. Return to the list. Press **j j j** to reach the third row. Press **e**
   → the athlete's edit sheet opens.
6. Close the sheet (press **Esc**). Press **j j** (second row highlighted).
   Press **d** → the delete confirmation dialog opens. Press **Cancel** to
   dismiss.
7. Focus the search input (click it). Press **j** → highlight does **not**
   move (input guard). Press **Esc** to blur the input.
8. Verify **Cmd+K** still opens the command palette (not broken).

#### List-page shortcuts — coach athletes (`/coach/athletes`)

1. Sign in as `coach.maria@sunrise-skating.com`, navigate to `/coach/athletes`.
2. Click the page background. First card has the ring highlight.
3. Press **j** / **k** → highlight moves between athlete cards.
4. Press **Enter** → navigates to `/coach/athletes/<id>`.

#### List-page shortcuts — admin programs (`/dashboard/registrations/programs`)

1. Navigate to `/dashboard/registrations/programs` as admin. First program card
   has the ring highlight.
2. Press **j** / **k** → highlight moves between cards.
3. Press **Enter** → navigates to the program's detail (or edit) page.
4. Return, press **j** to move to a non-DRAFT program, press **e** → the
   quick-configure sheet opens.

#### List-page shortcuts — coach programs (`/coach/programs`)

1. Navigate to `/coach/programs` as a coach. First program card has the ring
   highlight.
2. Press **j** / **k** → highlight moves between cards.

---

### Phase 0.1 — Cmd+K command palette

1. From any `/dashboard/*` page, press **⌘K** (Mac) or **Ctrl+K**. Palette opens in ≤ 100 ms.
2. Type `ath` → the **Athletes** section appears after ~250 ms. Open DevTools → Network and confirm a single `/api/athletes?search=…` request per debounce window, not one per keystroke.
3. Arrow keys highlight items; **Enter** navigates; **Escape** closes.
4. Top-bar has a **"Search ⌘K"** button — clicking it opens the same palette.
5. Sign out and log in as a coach (e.g. `coach.maria@sunrise-skating.com`) → palette's **Navigate** section shows only `/coach/*` routes. Athlete results navigate to `/coach/athletes/<id>`, not `/dashboard/…`.
6. Navigate to 5–6 pages, reopen palette → **Recent** section lists the last visited paths.

### Phase 0.5 — Micro-animations

1. Click any button — it scales to 96 % on press and springs back.
2. Tab into a form field — focus ring fades in over ~200 ms.
3. Click a link to another `/dashboard/*` page — content fades in from `y+8` over ~200 ms.
4. Visit `/dashboard` or `/coach` — KPI numbers count up from 0 on first render.
5. Reload a list page on a throttled network — the new `<Skeleton>` shimmer sweeps left-to-right (not the old pulse).
6. **macOS:** System Settings → Accessibility → Display → enable **Reduce motion**. Reload — all animations should be off.

### Phase 0.6 — Sonner toasts + skeletons

1. Edit an athlete, **Save** → bottom-right Sonner toast with an `×` close button.
2. Force an error: paste `bogus` in the federation member number field with **Skate Canada** selected → red toast with the validation message.
3. Visit `/superadmin/plans` → trigger a delete on any row → action-style confirm toast with "Delete"/"Cancel", **not** a browser `confirm()` dialog.
4. Navigate to `/superadmin/plans` on a throttled network → skeleton table renders within 100 ms before data lands.
5. Toggle dark mode → Toaster theme updates immediately.

### Commit A — Metro Sports gone

1. `/dashboard/organization` → only **one** org visible (Sunrise Skating).
2. Browser console: no 404s pointing to Metro athletes / programs / events.
3. `psql twizzle -c 'SELECT name FROM "Organization";'` → 1 row.

### Phase 1.x — Federation + disciplines

1. `/dashboard/athletes/<any-id>` → **Edit**. The **Disciplines** section has 5 toggle pills (Singles / Pairs / Ice Dance / Synchro / Special Olympics). Pick two, Save → badges show on the detail header.
2. With Federation = Skate Canada, type `bogus` in member number → inline red error + Save blocked.
3. `/dashboard/registrations/programs/<id>` → Requirements tab → **Federation Membership Requirement** toggle.
4. Enable the toggle. Open an athlete with no `federationMemberNumber`. Try `POST /api/enrollments` for them on that program → 400 with the block reason.

### What to look out for

- **Browser console errors.** Any uncaught exception lands in Sentry (`logger.exception` auto-routes after USC-660). Make sure none from our changes.
- **Layout regressions.** The `<motion.main>` wrapper in admin / coach / superadmin layouts could shift things subtly. Check for unexpected top padding.
- **Cmd+K conflict.** Browser extensions (1Password etc.) may capture ⌘K. Test with extensions disabled, or use the "Search ⌘K" header button.

---

## Per-feature tests

### 2026-05-29

#### Phase 4.1 — ISU element catalog seed

Static verification only — no DB or UI required.

**Row counts (run from repo root):**

```bash
# Total element rows
grep -c '^  {' prisma/isu-elements.ts
# expected: 116

# By kind
grep -c 'kind: "jump"'         prisma/isu-elements.ts  # 24
grep -c 'kind: "spin"'         prisma/isu-elements.ts  # 50
grep -c 'kind: "stepSequence"' prisma/isu-elements.ts  # 5
grep -c 'kind: "chorSequence"' prisma/isu-elements.ts  # 1
grep -c 'kind: "deathSpiral"'  prisma/isu-elements.ts  # 20
grep -c 'kind: "lift"'         prisma/isu-elements.ts  # 10
grep -c 'kind: "throw"'        prisma/isu-elements.ts  # 6
```

**Schema shape spot-check:**

```bash
node -e "
const { ISU_ELEMENTS } = require('./prisma/isu-elements');
// jump row
const t3 = ISU_ELEMENTS.find(e => e.code === '3T');
console.assert(t3.kind === 'jump' && t3.baseValue === 4.2 && t3.turns === 3 && t3.jumpType === 'T');
// spin row
const s4 = ISU_ELEMENTS.find(e => e.code === 'FSSp4');
console.assert(s4.kind === 'spin' && s4.level === 4 && s4.spinFamily === 'FSSp');
// step sequence
const sq3 = ISU_ELEMENTS.find(e => e.code === 'StSq3');
console.assert(sq3.kind === 'stepSequence' && sq3.baseValue === 4.2);
// death spiral
const ds = ISU_ELEMENTS.find(e => e.code === 'BoDs4');
console.assert(ds.kind === 'deathSpiral' && ds.entry === 'BoO' && ds.level === 4);
console.log('all assertions passed');
"
```

**Typecheck + lint:**

```bash
pnpm typecheck                              # must exit 0
pnpm lint                                   # "No ESLint warnings or errors"
pnpm format:check prisma/isu-elements.ts    # "All matched files use Prettier code style"
```

---

#### Phase 0.3 — Bento-grid Coach dashboard

1. Sign in as a coach and visit `http://coach.twizzle.localhost:3000/`.
2. Under the **Overview** heading you should see a 4-column Bento grid:
   - Large hero tile **Today** on the left (spans 2 columns × 2 rows) with
     a big event-count number and a "View today's schedule →" link.
   - Four small KPI tiles on the right: **Attendance** (pending today),
     **Programs** (active), **Competitions** (upcoming), **This week** (event count).
3. Hover any non-flat tile — it should lift ~2px with a softer shadow.
4. Click the hero tile → routes to `/coach/schedule`.
5. Click each clickable KPI → routes to its section (Attendance,
   Programs, This week → Schedule). The Competitions tile is currently
   non-clickable (`flat`) because it doesn't have a dedicated subpage.
6. Confirm the standalone "X events this week / View schedule" summary
   card at the bottom of the page is **gone** (its data now lives in
   the bento "This week" KPI).
7. Responsiveness: shrink the window — at `<md` breakpoints the grid
   collapses to a single column. Hero tile becomes a normal-height tile
   (col/row spans only apply at `md:`).

#### Phase 0.4 — FLIP table ↔ grid toggle on Athletes list

1. Visit `http://admin.twizzle.localhost:3000/dashboard/athletes` as an
   org admin with at least 3 athletes.
2. In the table toolbar (right side, next to the Refresh button) you
   should see a new `<ToggleGroup>` with two icon buttons: list icon
   (table view, default) and grid icon (card view).
3. Click the grid icon. The view morphs into a responsive card grid
   (1/2/3/4 cols at sm/md/lg/xl). Each athlete's **avatar + name pair
   should travel along a curved path** from its row position to the
   card position — not pop in. The animation lasts ~300 ms.
4. Click the list icon. The avatars travel back. The first/last name
   text remains continuous through the morph (no flash).
5. Existing filters/sorting work in both views — set a status filter
   like "Active only" and toggle modes; the same subset is rendered.
6. Pagination still works in grid mode (the page-size and page-nav
   controls render below the grid same as the table).
7. **Reduced motion test:** open System Preferences → Accessibility →
   Display → "Reduce motion" (macOS), reload, toggle views again — the
   avatars should snap to position with no animation.

---

#### Phase 4.2 — ISU shorthand abbreviation generator

Run the unit suite:

```
pnpm test src/lib/__tests__/isu-shorthand.test.ts
```

Expected: **63 passed**.

Representative API assertions (all from the test file):

```ts
// Jumps
generateIsuShorthand({ kind: "jump", turns: 3, type: "T" }) === "3T";
generateIsuShorthand({ kind: "jump", turns: 4, type: "Lz" }) === "4Lz";
generateIsuShorthand({ kind: "jump", turns: 2, type: "A" }) === "2A";
generateIsuShorthand({ kind: "jump", turns: 4, type: "A" }) === "4A";

// Jump combinations
generateIsuShorthand({
  kind: "jumpCombo",
  elements: [
    { turns: 3, type: "T" },
    { turns: 2, type: "T" },
  ],
}) === "3T+2T";
generateIsuShorthand({
  kind: "jumpCombo",
  elements: [
    { turns: 3, type: "F" },
    { turns: 2, type: "T" },
    { turns: 2, type: "Lo" },
  ],
}) === "3F+2T+2Lo";
generateIsuShorthand({ kind: "jumpCombo", elements: [] }) === ""; // empty → "" (documented)

// Spins
generateIsuShorthand({ kind: "spin", family: "FSSp", level: 4 }) === "FSSp4";
generateIsuShorthand({ kind: "spin", family: "CoSp", level: 3 }) === "CoSp3";
generateIsuShorthand({ kind: "spin", family: "LSp", level: "B" }) === "LSpB";

// Step + choreographic + spiral sequences
generateIsuShorthand({ kind: "stepSequence", level: 3 }) === "StSq3";
generateIsuShorthand({ kind: "stepSequence", level: "B" }) === "StSqB";
generateIsuShorthand({ kind: "chorSequence" }) === "ChSq1";
generateIsuShorthand({ kind: "spiralSequence" }) === "SpSq";

// Death spirals
generateIsuShorthand({ kind: "deathSpiral", type: "FoI", level: 1 }) === "FoIDS1";
generateIsuShorthand({ kind: "deathSpiral", type: "BoO", level: 4 }) === "BoODS4";

// Lifts
generateIsuShorthand({ kind: "lift", family: "4Li", level: 4 }) === "4Li4";
generateIsuShorthand({ kind: "lift", family: "CuLi", level: 2 }) === "CuLi2";

// Throws
generateIsuShorthand({ kind: "throw", turns: 3, type: "Lo" }) === "3ThLo";
generateIsuShorthand({ kind: "throw", turns: 4, type: "A" }) === "4ThA";
```

TypeScript verification — adding a new variant to `IsuElementInput` without
a switch arm produces a compile error on the `never` guard inside
`generateIsuShorthand`.

---

#### Shorthand search on the Evaluations page + searchable Level dropdown

Setup: `pnpm db:reset && pnpm db:seed` so the full STAR + CanSkate
catalog is in the DB (~95 templates per org).

**Page search shorthand** (`/dashboard/training/evaluations`):

- Type `cs3` in the **Templates** tab search → filters down to the
  three CanSkate Stage 3 ribbons (Balance / Control / Agility).
- Type `cs3 balance` → narrows to just CanSkate 3 — Balance.
- Type `star5` → STAR 5 templates across all disciplines surface
  (Freeskate Elements, Freeskate Program, Skills).
- Type `s5 dance` → STAR 5 Dance Step Elements.
- Type `precs` → Pre-CanSkate ribbon.
- Type a literal word like `silver` → matches Pattern Dance silver
  variants.
- Clear the search → all templates re-appear.
- DevTools Network tab during typing: **no** `/api/evaluation-templates?search=…`
  requests fire — filtering is purely client-side now.

**Searchable Level dropdown** (Create / Edit template sheet):

- Click **New Template**. The **Level** field is now a combobox
  (chevron icon on the right) instead of the old plain dropdown.
- Click it → a search input appears at the top of the list.
- Type `cs3` → list narrows to "CanSkate Stage 3". Enter selects it.
- Type `star` → all STAR levels surface.
- Type `precs` → "Pre-CanSkate".
- The first item is always "No level" (for the empty-string state).
- Edit an existing template (pencil icon) → the same searchable
  combobox, pre-populated with the template's current level.
- With <8 levels seeded, the combobox falls back to a plain Select
  (search adds no value at that size — verify by manually trimming
  the levels list, optional).

---

#### Fix: UplifterIcon overflowing the login card

- Open `http://login.twizzle.localhost:3000/login`. The Card stays
  inside its 400 px frame; the `[icon] Twizzle` brand mark sits
  comfortably centered with no horizontal overflow.
- Inspect the SVG (right-click → Inspect): it has explicit `width="47"`
  and `height="36"` attributes — not `width="auto"`.
- Resize the browser viewport down to 320 px wide → the Card scales
  down but the brand mark still fits inside it.

---

#### Login refresh round 3 — slower video fade, capital-T wordmark + icon, 1.5s theme switch

- Open `http://login.twizzle.localhost:3000/login` and watch a couple
  of loop boundaries on the background video. The opacity dip lasts
  roughly **4 seconds** total now (was 2 s) — noticeably more leisurely.
- The brand mark above each Card variant shows the legacy **purple
  balloon icon** followed by the word **"Twizzle"** (capital T). Both
  in primary purple.
- Inspect the icon (right-click → Inspect): it's an inline `<svg>`
  with two `<path>` elements and `fill="currentColor"`, scoped via
  the parent's text color. No extra image asset shipped.
- Click the theme toggle (top-right of any auth page or top-bar of
  the app). The clip-path reveal sweeping from the button across the
  viewport now takes about **1.5 seconds** (was 0.4 s). `Reduce
motion` users still skip the reveal entirely via the View
  Transitions native respect for `prefers-reduced-motion`.
- Toggle theme multiple times in a row — the animation queues
  cleanly; no flicker between toggles.

---

#### Login refresh round 2 — slower fades, soft buttons, wordmark, twizzle.localhost

- Open **http://login.twizzle.localhost:3000/login** (note the new
  domain — the old `login.uplifter.localhost:3000` now 404s).
- The video background fades in over **~2 seconds** on first load
  (was ~800 ms). Watch a full loop boundary — the opacity dip lasts
  ~2 s so the loop seam is invisible.
- No subtle grid lines on the gradient backdrop anymore — the page
  is pure gradient + video.
- The Microsoft / Google / Email Code buttons row uses a glassy
  background (`bg-card/30 backdrop-blur-md`), not the stark
  outline. Icons are noticeably **larger** (h-7 w-7).
- The "Or continue with" divider has **no horizontal rule and no
  background pill** — just a centered bold uppercase line.
- The brand mark above each Card heading is the word **"twizzle"**
  rendered in purple (`text-primary`), not the Uplifter image
  logo.
- Bookmarks pointing at the old `uplifter.localhost` subdomain
  return 404. Visit `twizzle.localhost` instead for every route
  (e.g. `admin.twizzle.localhost:3000/dashboard`,
  `coach.twizzle.localhost:3000/coach`).
- Old session cookies on `.uplifter.localhost` are gone — sign in
  fresh on `twizzle.localhost` to get a new session.

---

#### Login page refresh — video background, glass card, purple titles

- Open `http://login.uplifter.localhost:3000/login`. Browser-tab title
  is **"Twizzle"** (not "Uplifter").
- The page background is a looping video (the figure-skater clip in
  `public/twizzle_login_background.mp4`). On first load it fades in
  over ~800 ms.
- Watch the video through one or two loops — the seam between
  iterations is invisible: opacity gently dips just before the clip
  ends and rises again right after it restarts. No hard cut.
- The Card containing the sign-in form is **glassy** — the moving
  video shows through. Verify in light theme; toggle dark theme
  (top-right toggle) → still glassy, video still visible through.
- All headings on the page ("Verify your identity", "Sign in with
  email", "Check your email") render in the **purple** primary color,
  not black/foreground.
- macOS Accessibility → Display → enable **Reduce motion** → reload.
  Video still plays (it's content, not pure decoration), but the
  per-loop opacity fade is disabled (constant opacity instead).
- Inspect the logo image (right-click → Inspect): `alt` attribute is
  `"Twizzle"`.
- Navigate to a different auth page like `/forgot-password` — that one
  still uses the original gradient (not the video), confirming the
  video is login-only.

---

#### Fix: Federation Membership Requirement toggle on ProgramStepper

- Open `/dashboard/registrations/programs/new` (new-program wizard) →
  step **3. Requirements** → scroll past File Upload Requirement → see
  **Federation Membership Requirement** with description "Require
  athletes to hold a valid Skate Canada (or other federation)
  membership…". Toggle on, complete the wizard, save.
- DB: `SELECT "hasFederationMembershipRestriction" FROM "Program" WHERE id = '<new-program-id>';`
  → `true`.
- Open the same program at `/dashboard/registrations/programs/<id>/edit`
  → step 3 Requirements → toggle is **already on** (state restored from
  the API on load). Flip it off, save.
- DB query again → `false`.
- Sanity: the same toggle in the Settings sheet
  (`/dashboard/registrations/programs/<id>` → **Settings** button →
  Requirements tab) also reflects the same `false` after the stepper
  save (both edit surfaces write to the same field).

---

#### Fix: portal-aware login redirect + sidebar cross-links

- **Coach login lands on coach portal:** log in as
  `coach.maria@sunrise-skating.com` (or any user whose role is `COACH`).
  Expected: URL after sign-in is
  `http://coach.uplifter.localhost:3000/coach`, not `admin.…/dashboard`.
- **Admin login still lands on admin portal:** log in as
  `admin@sunrise-skating.com`. Expected: URL is
  `http://admin.uplifter.localhost:3000/dashboard`.
- **Pure coach doesn't see admin cross-link:** while signed in as the
  coach above, expand the coach sidebar. There should be **no** "Other
  Portals → Admin Dashboard" entry (they don't have admin access).
- **Admin doesn't see "Coach Portal" cross-link unless they coach:**
  while signed in as `admin@sunrise-skating.com`, expand the
  Access Points section in the admin sidebar — the **Coach Portal**
  link should be **absent** (admin has no `coaching.portal` perm).
  Add `coaching.portal` to the admin seed and reload → the link
  appears.
- **Hybrid users see both links:** for a user with both admin and
  coach perms (a superadmin, or a custom-perm admin who also has
  `coaching.portal`):
  - Admin sidebar shows the **Coach Portal** Access Point.
  - Coach sidebar shows **Other Portals → Admin Dashboard**.
- **`?callbackUrl=` still wins:** open
  `http://login.uplifter.localhost:3000/login?callbackUrl=/dashboard/athletes`,
  log in as a coach → the explicit callback URL is honored (lands on
  admin/athletes, not coach overview). The role-aware default only
  applies when no callback is supplied.

---

#### Fix: command palette cross-subdomain routing

- Log in as a coach who has admin permissions too (e.g. a superadmin)
  and land on `http://admin.uplifter.localhost:3000/dashboard`.
- Open Cmd+K → pick **Coach Overview**. Verify the URL becomes
  `http://coach.uplifter.localhost:3000/coach` (full-page nav across
  subdomains) and the coach overview renders. Previously: 404 at
  `admin.uplifter.localhost:3000/coach`.
- Reverse case: on the coach subdomain, open Cmd+K → pick **Dashboard**.
  URL becomes `http://admin.uplifter.localhost:3000/dashboard`.
- Same-subdomain navigation still uses client-side routing: on
  `admin.uplifter.localhost:3000/dashboard`, open Cmd+K → pick
  **Athletes**. Should be an instant client transition (no full reload
  flash), URL becomes `/dashboard/athletes`.

---

#### Phase 0.1 — Global Cmd+K command palette

- From any admin or coach page, press `Cmd+K` (or `Ctrl+K` on Windows/Linux)
  → palette opens within ≤ 100 ms.
- Click the "Search ⌘K" button in the top-bar → same palette opens.
- Click the `⌘K` / `Ctrl+K` badge in the sidebar search input → palette
  opens (sidebar search input itself is unaffected).
- Arrow keys move selection; `Enter` navigates to the highlighted item;
  `Escape` closes the palette.
- As an ADMIN user, type 3+ characters → Athletes and Programs sections
  appear after ~250 ms (verify with Network tab: exactly one request
  per debounce window, not one per keystroke).
- Select an athlete result → navigates to `/dashboard/athletes/<id>`.
- As a COACH user, the Navigate section shows only coach routes
  (`/coach/…`); athlete results navigate to `/coach/athletes/<id>`.
- Navigate to several pages, then reopen the palette → "Recent" section
  shows the last ≤ 5 visited paths.
- "Log out" action → calls `signOut` and redirects to `/login`.
- With `prefers-reduced-motion: reduce` set in OS/browser → palette
  appears instantly (no fade/zoom animation).

#### Phase 0.5 — Micro-animations on standard interactions

- Click any button — scales down to 96% on press and springs back.
- Tab to a button or input — focus ring fades in over ~200 ms.
- Navigate between dashboard pages — content fades in from y+8.
- Save/complete an action that shows a checkmark — path draws in.
- Load a KPI dashboard — numbers count up from 0.
- Any `<Skeleton>` — shimmer gradient sweeps.
- Enable "Reduce motion" in OS settings — all animations are disabled.

#### Phase 0.6 — Sonner toasts + unified skeletons

- Submit any form → Sonner toast bottom-right, auto-dismisses after ~4 s,
  manually dismissable via × button.
- Trigger an API error → red toast with the API error message.
- Click a delete button (e.g. Superadmin › Plans, Staff › Remove) →
  confirmation toast with "Delete"/"Cancel" appears; "Delete" proceeds,
  "Cancel" is a no-op.
- Navigate to `/superadmin/plans` on a slow connection → skeleton table
  renders within 100 ms before data loads.
- Toggle dark mode → Toaster theme updates immediately.

#### Delete Metro Sports demo (Commit A)

- `pnpm typecheck` → passes
- `pnpm lint` → no warnings or errors
- `pnpm format:check` → all files use Prettier code style
- `grep -c ORG2_ID prisma/seed-dev.ts` → 0
- After merge: `pnpm db:reset && pnpm db:seed` (the routine could not).

#### Phase 1.3 — Athlete discipline taxonomy

- Open the athlete edit sheet (`/dashboard/athletes/<id>` → **Edit**).
  Click two discipline pills (e.g. _Singles_ + _Ice Dance_), Save. The
  athlete detail header shows both as badges; reopen the sheet and the
  same pills are pressed.
- DB: `SELECT id, "firstName", disciplines FROM "Athlete" LIMIT 5;` —
  existing athletes have empty arrays; updated ones show the chosen
  enum values.
- API: `PATCH /api/athletes/<id>` with
  `{ "disciplines": ["SINGLES", "ICE_DANCE"] }` → 200, response carries
  the same array. Sending `["BANANA"]` → 400 (Zod enum reject).

#### Phase 1.2 — Federation membership prerequisite gate at enrollment

- `pnpm test src/lib/__tests__/federation-member-number.test.ts` (16
  cases — adds 6 for the enrollment-time gate covering missing number,
  expired before enrollment, valid through, boundary-equal expiry, null
  expiry fail-open, whitespace-only number).
- Manual (admin): open a program, toggle **Federation Membership
  Requirement** on, save. Try to add an athlete without a federation
  number via `POST /api/enrollments` — `400` with "Athlete needs a valid
  federation membership…". Set the athlete's `federationMemberExpiresAt`
  to a past date and retry — `400` with "Federation membership expired
  on …".
- Manual (checkout): same program above; complete a guest checkout for
  an unfederated athlete — fails at session-create with the
  athlete-named error, no Adyen charge.
- DB: `SELECT "hasFederationMembershipRestriction" FROM "Program" LIMIT 5;`
  → existing programs default `false`; new programs respect the toggle.

#### Phase 1.1 — Federation member-number format validation

- `pnpm test src/lib/__tests__/federation-member-number.test.ts` (10
  cases covering each federation, empty input, whitespace trimming,
  missing federation, and unknown federation).
- Manual (form): open the athlete edit sheet (`/dashboard/athletes` →
  click any athlete → **Edit**), set Federation to "Skate Canada", type
  `bogus` in Member Number → inline red error appears below the input;
  Save shows the same message in a Sonner toast and stays open. Change
  to `SC-12345678` → error clears, Save succeeds.
- Manual (API): `PATCH /api/athletes/<id>` with body
  `{ "federationName": "SKATE_CANADA", "federationMemberNumber": "bogus" }`
  → 400 with the federation hint in `error`.

### 2026-05-28

#### Skating-only scope cleanup — `Competition.competitionType` dropped

- `/dashboard/competitions/new` → wizard has **no** "Competition Type"
  step (RadioGroup with Trophy icons is gone).
- Any competition detail page → "Export to CSS" button is **always**
  available (used to be gated to `FIGURE_SKATING`).
- `/superadmin/competitions` table → no "Type" column.
- DB: `SELECT column_name FROM information_schema.columns WHERE
table_name='Competition';` → no `competitionType` column.

#### Full STAR catalog + searchable template picker

- `pnpm db:reset && pnpm db:seed` → seed completes without error.
- DB: `SELECT COUNT(*) FROM "EvaluationTemplate" WHERE "organizationId" = '<sunrise-org-id>';`
  → at least **71** STAR templates (Pre-CanSkate + CanSkate adds more).
- `/dashboard/training/evaluations` → click **New evaluation** → picker
  opens with templates grouped by discipline.
- Type `star 5` → results narrow to STAR 5 templates across all
  disciplines (Freeskate, Skills, Pattern Dance, Artistic).
- Type `silver` → Pattern Dance silver test sheets surface.
- Keyboard: ↑↓ moves selection, **Enter** picks, **Esc** closes.
- Pick a STAR template, mark all required skills passed, Save →
  achievement auto-awarded (toast appears).

#### Skate Canada CSS competition export

- Org settings → set `federationSection` (e.g. `ON`).
- Seed an athlete with `federationMemberNumber` + future
  `federationMemberExpiresAt` + birthDate + gender.
- Add the athlete to a competition entry.
- Competition detail page → **Export to CSS** button visible; click
  → CSV downloads.
- Open in a text editor: CRLF line endings; 14 columns; header row
  matches CSS's expected order (`EventCode,CatEventType,Category,
Discipline,RegistNo,First Name,Last Name,Gender,Age,Birthdate,
Club,Section Representing,Country,EOR`). Birthdate `MM/DD/YYYY`.
  `Section Representing` = `ON` (Ontario magic).
- Add an unfederated athlete or one with `WITHDRAWN` status to the
  competition → click Export → blocked-rows warning lists them
  inline; CSV omits them.
- Validate the file in Skate Canada CSS (manual): import accepts it
  without errors.

#### CanSkate ribbon catalog + coach evaluation surface

- `pnpm db:reset && pnpm db:seed` → seed runs `seedCanSkateRibbons`.
- DB:
  ```sql
  SELECT COUNT(*) FROM "Skill"
   WHERE name LIKE '%Balance%'
      OR name LIKE '%Control%'
      OR name LIKE '%Agility%'
      OR name LIKE '%Pre-CanSkate%';
  ```
  → **136** CanSkate skill rows.
- DB:
  ```sql
  SELECT COUNT(*) FROM "EvaluationTemplate"
   WHERE name LIKE 'CanSkate%' OR name = 'Pre-CanSkate';
  ```
  → **19** templates (Stage 1–6 × Balance/Control/Agility +
  Pre-CanSkate).
- `/api/evaluation-templates` → response items have `ribbonMeta` for
  each CanSkate template.
- Open a CanSkate template in the evaluation flow → ribbon-dimension
  badges render with the right Tailwind tokens.
- Mark every required skill passed, Save → toast surfaces with
  ribbon icon + dimension color.
- `pnpm lint` → no shadowed-import errors for `Ribbon` (local
  interface renamed to `RibbonItem`).

#### Track Skate Canada / USFS federation membership on athletes

- DB: `\d "OrganizationAthlete"` → columns include
  `federationName`, `federationMemberNumber` (indexed),
  `federationMemberExpiresAt`.
- `/dashboard/athletes/<id>` → **Edit**. Federation dropdown shows
  Skate Canada / U.S. Figure Skating / ISU. Number + expiry inputs
  are disabled until a federation is picked.
- Pick Skate Canada, enter `SC-12345678` and a future expiry, Save.
- Athlete detail header now shows `SC# 12345678` inline.
- Athlete detail Overview tab → Federation Membership card with
  full details + green **Active** badge.
- Set the expiry to a past date, Save → header badge shows
  `SC# 12345678 (expired)` in red, Overview card shows red
  **Expired** badge.
- As a guardian, `PATCH /api/athletes/<id>` with a federation field
  → 403 (these are in `STAFF_ONLY_FIELDS`).

#### Batch 1 — USC-150 `getScopedDb` upsert tenant-reassignment guard

- `pnpm test src/lib/__tests__/tenant-isolation.test.ts` (covers the
  attack pattern).
- Code review: any `getScopedDb(orgA).<model>.upsert({ where: …, create:
{ …, organizationId: orgB } })` should throw at runtime.

#### Batch 1 — Tenant leak on org announcements (marketing route)

- As an admin of org A, hit `/api/announcements` → only org A's rows.
- As an admin of org B, hit the same → only org B's rows. (Different
  cookies/sessions.)

#### Batch 1 — USC-940 zizmor GHA security findings

- `zizmor .github/` (if zizmor installed) → no findings.
- Open a draft PR → CI workflow runs and passes.
- `git diff origin/main~5 -- .github/workflows/ci.yml` shows the
  permissions + persist-credentials lines.

#### Batch 1 — USC-888 staff-only role gate on `/api/guardians/[id]`

- `pnpm test src/__tests__/api/guardians/[id]/route.test.ts` (covers
  6 cases: unauth, PARENT, role-without-permission, missing target,
  staff with permission, superadmin).
- Manual: log in as PARENT → `GET /api/guardians/<some-other-id>` →
  **403**.
- Log in as ADMIN → same → **200** (returns guardian scoped to your
  org).

#### Batch 2 — USC-586 wallet-backed stored payment-methods filter

- On checkout (`/sites/<slug>/checkout/...`), a saved Google-Pay-backed
  card now appears under the Google Pay tab on a Chrome/Android device,
  not duplicated on the card tab.

#### Batch 2 — USC-733 Prisma tx timeout

- Run a webhook-triggered registration for a program with **>20
  sessions**. Previously timed out (>5s tx limit); should now complete
  in under 3-5s.
- Inspect logs: no `Transaction already closed` errors.

#### Batch 3 — USC-660 `logger.exception` → Sentry

- Add a temporary call site in an API route:
  `logger.exception("smoke test", new Error("hello"))` → load the route
  → check Sentry inbox for the new event at `level=error`.
- For fatal-level verification: throw a constructed
  `{ name: "PrismaClientInitializationError" }` error through the same
  path → confirm Sentry event has `level=fatal`.

#### Batch 3 — USC-517 cron heartbeat

- Trigger any cron, e.g. `curl -X POST -H "Authorization: Bearer
$CRON_SECRET" http://localhost:3000/api/cron/cleanup`.
- `SELECT * FROM "CronHeartbeat" WHERE "cronName" = 'cleanup';` →
  `lastSuccessAt` is now a recent timestamp.
- In Sentry → Crons tab → see the cron registered with a recent
  check-in.

#### Batch 3 — USC-510 production Sentry setup

- Promote a staging image via the GHA workflow → check Sentry release
  list for a new release named with the short SHA.
- Throw `new Error("User abc123-def-456-… not found")` from two
  different code paths with different UUIDs → Sentry merges them into
  one issue tagged `User <id> not found`.
- Throw a synthetic error from `subscription-billing/route.ts` → a
  `level=fatal` Sentry event with `cron: subscription-billing` tag.

#### Batch 6 — USC-952 server-side pagination

- Wire any admin list page to server pagination:
  ```tsx
  const { pageIndex, pageSize, offset, setPageIndex, getPageCount } = useServerPagination();
  <DataTable
    manualPagination
    pageCount={getPageCount(total)}
    pageIndex={pageIndex}
    pageSize={pageSize}
    onPaginationChange={({ pageIndex: i }) => setPageIndex(i)}
    …
  />
  ```
- Click Next/Prev → confirm `pageIndex` updates and the API is called
  with `?offset=<pageIndex*pageSize>`.
- Empty result set → Prev is disabled (guard against stray `pageIndex
  > 0`).

### 2026-05-27

#### Figure-skating rebrand + drop Rotation models

- `pnpm prisma migrate status` → migration
  `20260527213526_drop_rotation_models` applied.
- DB: `\d "Rotation"` → relation does not exist.
- `pnpm db:reset && pnpm db:seed` → completes; new orgs are **Sunrise
  Skating Club** and **Demo Skating Club** (not Gymnastics).
- `/dashboard/training/skills` → skills grouped by **Edges /
  Footwork / Jumps / Spins / Field Moves / Conditioning** (not
  Apparatus / Beam / Floor / etc.).
- `/dashboard/training/rotations` → 404 (route deleted).
- Lesson plan UI → references "Session Blocks", not "Rotations".
- Facility seed → "Rink A" / "Harness #2" instead of "Balance Beam
  Area" / "Beam #3".
- View-source on any marketing page → SEO keywords reference
  figure-skating.

#### Rebrand leapfrog/uplifter → twizzle (local infra)

- `cat package.json | jq -r '.name'` → `twizzle`.
- `cat docker-compose.yml | grep container_name` → `twizzle-*`
  containers, not `leapfrog-*` or `uplifter-*`.
- `cat .env | grep DATABASE_URL` → connects to a `twizzle` database
  (port `5434` unchanged).
- `cat .github/CODEOWNERS` → no `@uplifterinc/*` owners.
- `.idea/` excluded from `git status` even if present locally.

### 2026-05-19 / 2026-05-20

#### Speed up sidebar navigation (Turbopack + sync layout + prefetch)

- `pnpm dev` → log line says `Next.js 14.x.x (turbo)` and `Ready in
~2-3 s`. (`pnpm dev:webpack` still works as a fallback.)
- Open `/dashboard` cold — skeleton renders inside ~100 ms while
  `DeactivationGuard` resolves behind it (it lives in a Suspense
  fallback now).
- Throttle network to "Slow 3G", click any sidebar item — the route
  swaps without a network waterfall because the chunk + RSC payload
  are pre-fetched on mount.
- DevTools → Performance → first click to a collapsed-section route
  uses the pre-fetched chunk (no fresh `_next/` request for it).

#### Cache list/detail fetches + add route-level skeletons

- Open `/dashboard/athletes` for the first time on a throttled network
  → `<Skeleton>` table renders within ~100 ms, replaced with data when
  the fetch lands.
- Navigate away, then back to `/dashboard/athletes` → renders **instantly**
  with cached data; DevTools Network shows a background refresh
  request firing after.
- Add an athlete via POST `/api/athletes` → return to list → new athlete
  appears immediately (cache invalidation worked).
- Repeat for `/dashboard/registrations/programs`, `/dashboard/reports`,
  and an athlete detail page — each has a route-level `loading.tsx`
  shaped to its content.

#### Collapse admin sidebar sections by default (accordion)

- Open `/dashboard` → no sidebar sections expanded (all chevrons
  closed).
- Click a section header → it opens; click a second section → first
  one auto-closes (only one open at a time).
- Use the sidebar search input → all sections containing matches
  auto-open; clear the search → they collapse back.

#### Fix: skip fail-closed rate limiting in dev when Redis is unconfigured

- Unset `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in
  `.env`, restart dev server.
- Visit `/login` → magic-link email submits without a 429.
- Source check: `src/lib/rate-limit.ts:checkRateLimit` gates the
  fail-closed branch on `!isDev`.
- Set the Upstash env vars on staging / production → rate limiting
  applies and the route returns 429 on flood (regression check —
  prod path unchanged).
