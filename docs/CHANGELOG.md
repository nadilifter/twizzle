# Twizzle Changelog

Running log of features and fixes shipped to `main`, with steps to verify
each. Newest first.

---

## 2026-05-29

### Phase 0.5 — Micro-animations on standard interactions

Added subtle, consistent animations to design-system primitives so every page inherits them without per-page edits.

**Test:**

- [ ] Click any button — it scales down to 96% on press and springs back
- [ ] Tab to a button or input — focus ring appears with a 200ms fade-in transition
- [ ] Navigate between dashboard pages — content fades in from y+8 over 200ms
- [ ] Save/complete an action that shows a checkmark — checkmark draws in with path animation
- [ ] Load a KPI dashboard — numbers count up from 0 to their value over ~1s
- [ ] Load any skeleton placeholder — shimmer gradient sweeps across it
- [ ] Enable "Reduce motion" in OS settings — all animations are disabled

---

## 2026-05-28

### Skating-only scope cleanup — `Competition.competitionType` dropped

Removed the multi-sport competition-type field end-to-end. Twizzle is
skating-only; the field served only an extra wizard step.

**Test:**

- `/dashboard/competitions/new` → wizard has **no** "Competition Type"
  step (RadioGroup with Trophy icons is gone).
- Any competition detail page → "Export to CSS" button is **always**
  available (used to be gated to `FIGURE_SKATING`).
- `/superadmin/competitions` table → no "Type" column.
- DB: `SELECT column_name FROM information_schema.columns WHERE
table_name='Competition';` → no `competitionType` column.

---

### Roadmap doc (`docs/ROADMAP.md`)

Six-phase plan for closing Uplifter parity on Skate Canada integration

- carry-over legacy cleanup. Includes parity scorecard mapping each
  task to the Uplifter feature it closes.

**Test:** read `docs/ROADMAP.md` — see 6 phases, 17 tasks, dependency
table, scorecard.

---

### Batch 1 — Upstream security + tenant-isolation fixes (4 commits)

#### USC-150 — `getScopedDb` upsert tenant reassignment guard

Prevents a scoped Prisma client from writing a row into another org's
tenancy via `.upsert({ data: { organizationId: <other-org> } })`.

**Test:**

- `pnpm test src/lib/__tests__/tenant-isolation.test.ts` (covers the
  attack pattern).
- Code review: any `getScopedDb(orgA).<model>.upsert({ where: …, create:
{ …, organizationId: orgB } })` should throw at runtime.

#### Tenant leak on org announcements (marketing route)

Fixed cross-tenant exposure where a marketing-route announcement query
returned announcements from another org.

**Test:**

- As an admin of org A, hit `/api/announcements` → only org A's rows.
- As an admin of org B, hit the same → only org B's rows. (Different
  cookies/sessions.)

#### USC-940 — zizmor GHA security findings (manual port)

Pinned action versions, added `permissions: contents: read`, set
`persist-credentials: false` on checkout steps, bumped checkout@v4→v6
and `aws-secretsmanager-get-secrets` v2→v3. New `.github/zizmor.yaml`
ref-pin policy.

**Test:**

- `zizmor .github/` (if zizmor installed) → no findings.
- Open a draft PR → CI workflow runs and passes.
- `git diff origin/main~5 -- .github/workflows/ci.yml` shows the
  permissions + persist-credentials lines.

#### USC-888 — staff-only role gate on `/api/guardians/[id]`

Closes IDOR sibling of USC-679 — a PARENT-role user could fetch any
other parent's profile by ID. Now gated on `families.view` permission.

**Test:**

- `pnpm test src/__tests__/api/guardians/\[id\]/route.test.ts` (covers
  6 cases: unauth, PARENT, role-without-permission, missing target,
  staff with permission, superadmin).
- Manual: log in as PARENT → `GET /api/guardians/<some-other-id>` →
  **403**.
- Log in as ADMIN → same → **200** (returns guardian scoped to your
  org).

---

### Batch 2 — Adyen / refund / webhook hardening (2 standalone commits)

#### USC-586 — wallet-backed stored payment methods filter by brand

`amex_googlepay` and similar stored methods have type `"scheme"`, so
`isWalletType` was returning false. Now normalizes via
`normalizePaymentMethodType` before the check.

**Test:**

- On checkout (`/sites/<slug>/checkout/...`), a saved Google-Pay-backed
  card now appears under the Google Pay tab on a Chrome/Android device,
  not duplicated on the card tab.
- Hit the stored-payment-methods API on a guardian with a wallet card →
  inspect that the wallet card has the correct grouping.

#### USC-733 — Prisma tx timeout + parallel webhook upserts

Parallelizes sequential `InstanceRegistration` upserts in
`processInvoiceRegistrations` (`for` loop → `Promise.all`); bumps
Prisma interactive transaction timeout to 10s on the webhook/checkout
path and 15s on waitlist-promotion.

**Test:**

- Run a webhook-triggered registration for a program with **>20
  sessions**. Previously timed out (>5s tx limit); should now complete
  in under 3-5s.
- Inspect logs: no `Transaction already closed` errors.

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

**Test:**

- Add a temporary call site in an API route:
  `logger.exception("smoke test", new Error("hello"))` → load the route
  → check Sentry inbox for the new event at `level=error`.
- For fatal-level verification: throw a constructed
  `{ name: "PrismaClientInitializationError" }` error through the same
  path → confirm Sentry event has `level=fatal`.

> **Partial:** upstream's redis.ts changes target `ioredis` (we use
> `@upstash/redis`) and db.ts changes target `pg Pool` (we don't use
> the raw pool). Those land if/when we adopt those infrastructure
> changes.

#### USC-517 — cron heartbeat + Sentry check-in monitoring

New `CronHeartbeat` table; every cron upserts `lastSuccessAt` on
successful completion AND calls Sentry's
`captureCheckIn` / `endCronMonitoring`. Sentry's native cron
miss-detection now alerts when a cron misses its expected interval.

**Test:**

- Trigger any cron, e.g. `curl -X POST -H "Authorization: Bearer
$CRON_SECRET" http://localhost:3000/api/cron/cleanup` (or whatever
  vercel.json schedules).
- `SELECT * FROM "CronHeartbeat" WHERE "cronName" = 'cleanup';` →
  `lastSuccessAt` is now a recent timestamp.
- In Sentry → Crons tab → see the cron registered with a recent
  check-in.

#### USC-510 — production Sentry setup (DSN injection, fingerprinting, fatal alerting)

- `promote-production.yml` rebuilds the image from source with prod
  Sentry DSN baked in (previous retag approach baked staging DSN).
- `Dockerfile` adds `ENV SENTRY_RELEASE=$SENTRY_RELEASE` so Sentry
  releases are named correctly.
- `next.config.mjs` routes `withSentryConfig` to `uplifter-us-prod`
  when `APP_ENVIRONMENT=production`.
- Sentry configs add **fingerprint normalization** — errors with
  dynamic UUIDs / numeric IDs collapse into one issue instead of
  fragmenting per-ID.
- Cron crashes in `subscription-billing` / `subscription-dunning` now
  fire fatal Sentry events instead of silent `console.error`.

**Test:**

- Promote a staging image via the GHA workflow → check Sentry release
  list for a new release named with the short SHA.
- Trigger a fingerprint test: throw `new Error("User abc123-def-456-…
not found")` from two different code paths with different UUIDs →
  Sentry merges them into one issue tagged `User <id> not found`.
- Throw a synthetic error from `subscription-billing/route.ts` → a
  `level=fatal` Sentry event with `cron: subscription-billing` tag.

---

### Batch 6 — Server-side pagination infrastructure (USC-952)

New opt-in mode on `<DataTable>` and a standalone `<ServerPagination>`
control + `useServerPagination()` hook for non-table lists. Default
client-side pagination path is unchanged for existing callers.

**Test:**

- Wire any admin list page to server pagination:
  ```tsx
  const { pageIndex, pageSize, offset, setPageIndex, getPageCount }
    = useServerPagination();
  <DataTable
    manualPagination
    pageCount={getPageCount(total)}
    pageIndex={pageIndex}
    pageSize={pageSize}
    onPaginationChange={({pageIndex: i}) => setPageIndex(i)}
    …
  />
  ```
- Click Next/Prev → confirm `pageIndex` updates and the API is called
  with `?offset=<pageIndex*pageSize>`.
- Empty result set → Prev is disabled (guard against stray `pageIndex
  > 0`).

> **Direct unlock:** Roadmap Phase 5.2 (`FederationSubmission` admin
> queue page) can wire straight to this instead of building pagination
> from scratch.

---

## Earlier work (pre-changelog)

- See git log for the figure-skating rebrand, Skate Canada CSS export,
  CanSkate ribbon catalog, STAR test sheet catalog, federation
  membership tracking, and searchable template picker. These predate
  this changelog file.
