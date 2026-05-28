# Twizzle Roadmap

Six-phase plan to close the parity gap with Uplifter on Skate Canada
integration, plus carry-over legacy cleanup from the skating-only
rebrand.

Ordered by dependency + effort. Phase 0 unblocks every later phase by
removing dead multi-sport scaffolding. Phases 1-5 can run somewhat in
parallel. Phase 6 is gated on Skate Canada granting API access — it is
a partnership question, not a code question.

Task IDs reference the in-session task list. Effort estimates assume
one engineer working with full context.

---

## Phase 0 — Legacy cleanup (carry-over)

Twizzle was rebranded from gymnastics-multi-sport to skating-only on
2026-05-27. Three deletion commits were planned; Commit C
(`Competition.competitionType`) shipped on 2026-05-28. The remaining
two are pre-authorized per the skating-only scope decision.

| Task | Subject                                                                                                            | Effort                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| #48  | Commit A — delete Metro Sports demo from `seed-dev.ts`                                                             | ~half-day (539 `ORG2_ID` references across ~60 sections of a 10K-line file)                           |
| #49  | Commit B — drop `Sport` / `SportEvent` / `SportAgeCategory` / `OrganizationSport` / `SportEventEligibility` models | ~1 day (schema migration + ~15 src files; whole-page rewrite of `/superadmin/competition-categories`) |

**Why first:** any new feature inherits the multi-sport conceptual
baggage if these stay. Both already pre-authorized.

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

| Phase               | Effort     | Blocking?                                  |
| ------------------- | ---------- | ------------------------------------------ |
| 0. Legacy cleanup   | ~1.5 days  | Reduces every future task's confusion cost |
| 1. Quick wins       | ~3.5 days  | None                                       |
| 2. Bulk import      | ~2 days    | None                                       |
| 3. Identity merge   | ~3-5 days  | Recommended before Phase 5                 |
| 4. Element tools    | ~9 days    | None — parallel-friendly                   |
| 5. Submission infra | ~5-6 days  | Recommended before Phase 6                 |
| 6. Live CRM         | ~2-3 weeks | **Gated on Skate Canada partnership**      |

**Realistic ship order if working solo:** 0 → 1 → 2 → 3 → 5 → 4 → 6.

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
