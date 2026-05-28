# Twizzle Roadmap

Seven-phase plan: UI modernization (Phase 0), then closing the parity
gap with Uplifter on Skate Canada integration (Phases 1-6). Carry-over
legacy cleanup from the skating-only rebrand lives in Appendix A.

Ordered by dependency + effort. Phase 0 lifts the user-facing product
quality before Phase 1+ feature work compounds on top of it — every
new screen we build later benefits from the primitives Phase 0 lays
down (command palette, optimistic mutations, animation system). Phases
1-5 can run somewhat in parallel. Phase 6 is gated on Skate Canada
granting API access — it is a partnership question, not a code
question.

Task IDs reference the in-session task list. Effort estimates assume
one engineer working with full context.

---

## Phase 0 — UI Modernization

Lift the perceived quality of the product. Every library we need is
already installed (`framer-motion@12`, `cmdk`, `sonner`,
`@tanstack/react-query@5`, `next-themes`, `motion`) — Phase 0 deploys
them broadly. The goal is that opening Twizzle feels closer to Linear
/ Vercel / Notion than to a dated CRUD admin.

| Task | Subject                                                               | Effort  | Blocked by |
| ---- | --------------------------------------------------------------------- | ------- | ---------- |
| 0.1  | Global Cmd+K command palette                                          | ~3 days | —          |
| 0.2  | Optimistic UI on high-frequency mutations (TanStack Query `onMutate`) | ~3 days | —          |
| 0.3  | Bento-grid layouts on Coach + Admin dashboards                        | ~3 days | —          |
| 0.4  | FLIP layout transitions on list↔grid + list→detail                    | ~2 days | —          |
| 0.5  | Micro-animations on standard interactions                             | ~2 days | —          |
| 0.6  | Sonner toast adoption + unified skeleton loaders                      | ~1 day  | —          |
| 0.7  | Empty-state illustrations + inline-edit affordances                   | ~2 days | —          |
| 0.8  | Power-user keyboard shortcuts (`j`/`k`, `?`, escape-everywhere)       | ~1 day  | 0.1        |

**Total:** ~17 engineering days. Tasks 0.1-0.7 are all independent —
shippable in any order. The natural opening move is 0.1 (command
palette) because it's the single most-visible quality signal and
unlocks 0.8.

### 0.1 — Global Cmd+K command palette

A keyboard-first launcher that puts every page, every athlete, every
program, every common action one shortcut away.

- **Component:** new `<CommandPalette/>` mounted in `src/components/app-shell.tsx` (or equivalent root layout), opened via global `Cmd+K` / `Ctrl+K`, dismissed via Escape.
- **Built on:** existing `src/components/ui/command.tsx` (already cmdk-backed) + Radix `Dialog`. No new deps.
- **Sections:**
  - **Navigate** — every top-level admin + coach route, fuzzy-searched.
  - **Athletes** — debounced query against `/api/athletes?search=` (server-side filter).
  - **Programs** — same pattern.
  - **Actions** — "New athlete", "New program", "New evaluation", "Switch organization", "Log out".
  - **Recent** — last 5 pages visited (localStorage).
- **Verification:**
  - On any page, `Cmd+K` opens the palette in < 100 ms (preload route via React `lazy` is fine).
  - Typing 3+ characters in the Athletes section fetches once after 250 ms debounce.
  - Arrow keys move selection; Enter navigates; Escape closes.
  - Selecting an athlete navigates to `/dashboard/athletes/<id>` (or coach equivalent if role=COACH).

### 0.2 — Optimistic UI on high-frequency mutations

Move the four highest-frequency mutations to TanStack Query with
`onMutate` cache updates so the UI flips instantly and the network
round-trip is invisible. Roll back the optimistic update on error.

- **Targets** (highest user-facing frequency first):
  - **Mark attendance** (`POST /api/attendance/...`) — coach taps a row to mark present / absent, list re-renders instantly.
  - **Mark evaluation skill** (CanSkate ribbons + STAR test sheet rows) — coach taps a Skill row to mark "passed".
  - **Toggle program status** (active / inactive / archived) — admin toggle on programs list.
  - **Update athlete status** (active / inactive / waitlisted) — admin toggle on athletes list.
- **Pattern:**

  ```tsx
  const m = useMutation({
    mutationFn: markAttendance,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, optimisticUpdate(prev, vars));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(queryKey, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
  ```

- **Prereq:** for any page not yet on TanStack Query, lift the fetch into `useQuery` first. We already have it installed (used in `src/app/dashboard/organization/features/page.tsx`).
- **Verification:**
  - Throttle network to "Slow 3G" in devtools; tap attendance → row updates within 1 frame.
  - Force the API to 500; row reverts; Sonner error toast appears.
  - No double-fetch on success (server response is treated as canonical via `invalidateQueries`).

### 0.3 — Bento-grid dashboards

Replace the "row of equal cards" dashboard layouts with a Bento grid:
varied tile sizes that put high-value info at the top-left and detail
in smaller tiles. Modern, scannable, and visually distinctive.

- **Targets:**
  - **Coach dashboard** (`src/app/coach/page.tsx`) — large "Today's lessons" tile, medium "My athletes" tile, small "Upcoming evaluations" + "This week's attendance" tiles.
  - **Admin dashboard** (`src/app/dashboard/page.tsx`) — large "Active members" tile with sparkline, medium "Pending registrations" tile, small KPI tiles (revenue, churn, active programs), wide-bottom "Recent activity" feed.
  - **Athlete profile** (`src/app/dashboard/athletes/[id]/page.tsx`) — bio card (wide), skills tracker grid (large), recent evaluations (medium), federation status (small), next milestones (small).
- **Tech:** CSS Grid with `grid-template-areas`; tile components share a `<BentoTile>` wrapper that handles spans + hover lift.
- **Verification:**
  - Tile spans reflow gracefully at `md:` and `sm:` breakpoints (Tailwind responsive).
  - Hover lifts each tile by 2px with a soft shadow (via 0.5).
  - Empty state per tile (handled in 0.7) — e.g. "No lessons scheduled today" with an illustration.

### 0.4 — FLIP layout transitions

Use Framer Motion's `layoutId` to morph elements between two positions
instead of cross-fading. Especially for list-to-grid view toggles and
clicking a list row to open a detail view.

- **Targets:**
  - **Athletes list** (`src/app/dashboard/athletes/page.tsx`) — toggle between table view and card grid: avatar/name pair morphs from row to card cleanly.
  - **Programs list** (`src/app/dashboard/programs/page.tsx`) — same pattern.
  - **List→detail** — clicking an athlete row in the list animates the avatar + name to its position in the detail page header (use `<motion.div layoutId={`athlete-${id}`} />` on both ends).
- **Tech:**

  ```tsx
  <AnimatePresence>
    {viewMode === "grid" ? (
      items.map((it) => (
        <motion.div key={it.id} layoutId={`athlete-${it.id}`} layout>
          …card markup
        </motion.div>
      ))
    ) : (
      <table>… </table>
    )}
  </AnimatePresence>
  ```

- **Verification:**
  - Toggle grid/list — avatars travel along a curved path, not pop in.
  - Click a list row → detail page opens with the avatar arriving at the header.
  - Transitions complete in 300 ms (`transition={{ duration: 0.3, ease: "easeOut" }}`).
  - `prefers-reduced-motion: reduce` disables the layout animation.

### 0.5 — Micro-animations on standard interactions

Wire small, consistent animations into the design-system primitives so
every page inherits them without per-page work.

- **Button press** — `whileTap={{ scale: 0.96 }}` on `<Button>`.
- **Focus ring** — subtle 200 ms scale + glow on `:focus-visible`.
- **Page transitions** — wrap each route group's layout in a `<motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} />` (50 ms stagger between sibling sections).
- **Success states** — Lottie-free SVG checkmark draw-in on completed evaluations / saved forms (use Framer's `pathLength` interpolation).
- **Number counters** — animate KPI numbers on dashboard tiles from 0 → final on mount (Framer's `useMotionValue` + `useTransform`).
- **Skeleton shimmer** — uniform `<Skeleton>` component with a single shimmer gradient (currently scattered).
- **Where:** edits live in `src/components/ui/{button,input,skeleton}.tsx` and the route-group layouts under `src/app/`.
- **Verification:**
  - Tap any button — visible press without UI jank.
  - Tab through a form — focus ring eases in.
  - Navigate between admin pages — content fades + slides up.
  - All animations respect `prefers-reduced-motion`.

### 0.6 — Sonner toasts + unified skeletons

Adopt Sonner as the single toast layer (it's installed but not yet
wired) and consolidate the dozen different "loading…" states into one
`<Skeleton>` component.

- **Sonner:**
  - Mount `<Toaster />` in root layout.
  - Replace any `alert()`, `confirm()`, or ad-hoc "saved" badges with `toast.success` / `toast.error`.
  - Custom toast components for **long-running operations** (CSS export, bulk imports) with progress and a "View" link.
- **Skeletons:**
  - One `<Skeleton width=… height=… rounded=…/>` primitive in `src/components/ui/skeleton.tsx` (if not already canonical).
  - Page-level skeletons under `src/app/<route>/loading.tsx` for instant LCP.
- **Verification:**
  - Submit any form → Sonner toast bottom-right; auto-dismisses after 4 s; manually dismissable.
  - Errors show red toast with the API error message and a "Retry" action.
  - Navigate to any list page on a slow connection → skeleton shimmer renders within 100 ms.

### 0.7 — Empty states + inline-edit affordances

Small but high-impact polish.

- **Empty states:** every list / table / dashboard tile with zero rows shows a friendly illustration (we can use [`@radix-ui/react-icons`](https://www.radix-ui.com/icons) or a small set of custom SVGs) + a contextual CTA ("Add your first athlete" → opens the new-athlete dialog).
- **Inline edit:** double-click any name / title field in lists / detail pages to edit in place; Enter saves (0.2's optimistic pattern), Escape cancels. Targets: athlete name, program name, skill names, category names.
- **Verification:**
  - Drop the seed athlete count to 0 → athletes page shows the empty state, not a blank table.
  - Double-click an athlete name in the list → input replaces it, Enter saves optimistically.

### 0.8 — Power-user keyboard shortcuts

Build on 0.1's command palette infrastructure.

- **Global:**
  - `?` opens a shortcut help dialog.
  - `Escape` closes anything dismissable (dialogs, sheets, palette).
  - `g` then letter — `g a` athletes, `g p` programs, `g c` competitions, `g s` settings (vim-style sequenced).
- **List pages:**
  - `j` / `k` move row selection.
  - `Enter` opens the selected row.
  - `e` opens edit; `d` opens delete confirm.
- **Verification:**
  - From any page, `?` opens a help dialog enumerating every shortcut.
  - On the athletes list, `j` `j` `j` `Enter` opens the third athlete.

---

## Phase 1 — Quick wins

Small, foundational, independent. Cheap immediate value.

| Task | Subject                                                                                        | Effort  |
| ---- | ---------------------------------------------------------------------------------------------- | ------- |
| #55  | **1.1** Skate Canada member-number format validation                                           | ~1h     |
| #56  | **1.2** Federation membership prerequisite gate at enrollment                                  | ~1 day  |
| #57  | **1.3** Athlete discipline taxonomy (Singles / Pairs / Ice Dance / Synchro / Special Olympics) | ~2 days |

**Why early:** all three are independent and cheap. Task 57 also
informs Phase 3 (athlete merge) and Phase 4 (ISU element tools).

---

## Phase 2 — Bulk import

| Task | Subject                                                 | Effort  |
| ---- | ------------------------------------------------------- | ------- |
| #58  | **2.1** Runtime CSV import for per-athlete achievements | ~2 days |

Reuses the existing `checkAndAwardAchievements` service; just adds the
runtime upload UI. The catalog itself is already imported at seed time.

---

## Phase 3 — Identity reconciliation

| Task | Subject                                           | Effort    | Blocked by |
| ---- | ------------------------------------------------- | --------- | ---------- |
| #59  | **3.1** Athlete merge preserving federation GUIDs | ~3-5 days | #57        |

Parallel to `GuardianClaimRequest` but for athletes. Preserves the
oldest `federationMemberNumber`, merges enrollment history, leaves an
audit trail. Needed before Phase 5/6 so duplicate athletes don't
poison SC submissions.

---

## Phase 4 — Program-element tools

| Task | Subject                                                                        | Effort  | Blocked by |
| ---- | ------------------------------------------------------------------------------ | ------- | ---------- |
| #60  | **4.1** ISU element catalog seed (jumps / spins / steps / lifts / throws)      | ~2 days | —          |
| #61  | **4.2** ISU shorthand abbreviation generator (`3T`, `FSSp4`, `ChSq1`, `StSq3`) | ~2 days | —          |
| #62  | **4.3** Planned-program builder UI                                             | ~5 days | #60, #61   |

Independent of CRM integration. Coaches can plan programs whether or
not Skate Canada API access exists.

---

## Phase 5 — Submission infrastructure (CRM-ready, CRM-independent)

Lets us ship a useful **manual** Skate Canada workflow today. Phase 6
swaps the manual transitions for API calls without restructuring the
data model.

| Task | Subject                                                                        | Effort    | Blocked by |
| ---- | ------------------------------------------------------------------------------ | --------- | ---------- |
| #63  | **5.1** `FederationSubmission` model (DRAFT → SUBMITTED → ACCEPTED / REJECTED) | ~1 day    | —          |
| #64  | **5.2** Admin submission queue page (manual status transitions)                | ~3 days   | #63        |
| #65  | **5.3** Submission audit log (append-only events)                              | ~1 day    | #63        |
| #66  | **5.4** `SkateCanadaSeason` data model with `scSeasonGuid` placeholder         | ~half-day | —          |

---

## Phase 6 — Live Skate Canada CRM integration

> **Gated on Skate Canada granting API access.** This is a partnership
> question, not a code problem. Until access is granted, none of the
> tasks below can start — Phase 5 covers the manual workflow in the
> interim.

| Task | Subject                                                                       | Effort    | Blocked by      |
| ---- | ----------------------------------------------------------------------------- | --------- | --------------- |
| #67  | **6.1** SOAP client + Dynamics CRM auth                                       | ~3-5 days | — (partnership) |
| #68  | **6.2** Live membership lookup endpoint (replaces #55)                        | ~2 days   | #67             |
| #69  | **6.3** Automated registration submission (replaces #64's manual transitions) | ~3 days   | #63, #67        |
| #70  | **6.4** Season synchronization — populate `sc_season_guid` from API           | ~2 days   | #66, #67        |
| #71  | **6.5** Category-name drift detection                                         | ~1 day    | #67             |

**Total Phase 6:** ~2-3 weeks once Skate Canada API access exists.

---

## Roll-up

| Phase                   | Effort     | Blocking?                                                     |
| ----------------------- | ---------- | ------------------------------------------------------------- |
| 0. UI Modernization     | ~17 days   | Lifts the product feel before Phase 1+ compounds on top       |
| 1. Quick wins           | ~3.5 days  | None                                                          |
| 2. Bulk import          | ~2 days    | None                                                          |
| 3. Identity merge       | ~3-5 days  | Recommended before Phase 5                                    |
| 4. Element tools        | ~9 days    | None — parallel-friendly                                      |
| 5. Submission infra     | ~5-6 days  | Recommended before Phase 6                                    |
| 6. Live CRM             | ~2-3 weeks | **Gated on Skate Canada partnership**                         |
| _A. Carry-over cleanup_ | ~1.5 days  | Pre-authorized cleanup from skating-only rebrand (Appendix A) |

**Realistic ship order if working solo:** 0.1 → 0.2 → 0.6 → 0.5 → 0.3 → 0.4 → 0.7 → 0.8 → 1 → 2 → 3 → 5 → 4 → 6. Slot Appendix A (Commits A + B) whenever a low-energy day hits.

---

## Parity-with-Uplifter scorecard

What this roadmap closes, organized by Uplifter's Skate Canada
integration pillars:

### A. National Body Integration (Skate Canada API)

| Uplifter feature                   | Twizzle today      | After this roadmap               |
| ---------------------------------- | ------------------ | -------------------------------- |
| Membership Lookup & Validation     | ❌ none            | ✅ (#55 local → #68 live)        |
| Automated Registration Submissions | ❌ none            | ✅ (#63 + #64 manual → #69 live) |
| Category Matching                  | ⚠️ name match only | ✅ (#71 drift detection)         |
| Season Synchronization             | ❌ none            | ✅ (#66 schema → #70 live sync)  |

### B. Participant & Membership Management

| Uplifter feature                    | Twizzle today   | After this roadmap   |
| ----------------------------------- | --------------- | -------------------- |
| Skate Canada Participant Manager    | ⚠️ display only | ✅ (#63 + #64 + #65) |
| Conflict Resolution / Athlete merge | ❌ none         | ✅ (#59)             |
| Prerequisite Enforcement            | ⚠️ level only   | ✅ (#56)             |

### C. Figure Skating Specific Tools

| Uplifter feature                  | Twizzle today          | After this roadmap |
| --------------------------------- | ---------------------- | ------------------ |
| Program Element Fields            | ❌ none                | ✅ (#60 + #62)     |
| Shorthand Abbreviation Generation | ❌ none                | ✅ (#61)           |
| Discipline Tracking               | ⚠️ template-level only | ✅ (#57)           |

### D. Evaluations & Achievement Tracking

| Uplifter feature                | Twizzle today           | After this roadmap |
| ------------------------------- | ----------------------- | ------------------ |
| Predefined Evaluation Templates | ✅ (more than Uplifter) | ✅                 |
| Bulk Evaluation Imports         | ⚠️ seed-time only       | ✅ (#58)           |

---

## Appendix A — Carry-over cleanup

Pre-authorized cleanup work left over from the skating-only rebrand
(2026-05-27). Independent of every phase — slot in whenever convenient.

| Task | Subject                                                                                                            | Effort                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| #48  | Commit A — delete Metro Sports demo from `seed-dev.ts`                                                             | ~half-day (539 `ORG2_ID` references across ~60 sections of a 10K-line file)                           |
| #49  | Commit B — drop `Sport` / `SportEvent` / `SportAgeCategory` / `OrganizationSport` / `SportEventEligibility` models | ~1 day (schema migration + ~15 src files; whole-page rewrite of `/superadmin/competition-categories`) |
