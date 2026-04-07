# API Development Conventions

## Tenant Isolation

Every API route must scope data to the authenticated user's organization. Cross-organization data leakage is a critical security vulnerability.

### Getting the Organization ID

```typescript
import { getAuthSession } from "@/lib/auth";

const session = await getAuthSession();
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const organizationId = session.user.organizationId;
```

**Never** use an `organizationId` from the request body, query parameters, or form data in authenticated routes. For public endpoints, see Pattern 4 below.

### Pattern 1: Direct `organizationId` Models (use `getScopedDb`)

Models in the `TENANT_MODELS` array (see `src/lib/db.ts`) have a direct `organizationId` column. Use `getScopedDb` to auto-scope all operations:

```typescript
import { getScopedDb } from "@/lib/db";

const scopedDb = getScopedDb(session.user.organizationId);

// Reads are auto-filtered by organizationId
const programs = await scopedDb.program.findMany();

// Creates auto-set organizationId
const program = await scopedDb.program.create({ data: { name: "New" } });

// Updates/deletes verify ownership before executing
await scopedDb.program.update({ where: { id }, data: { name: "Updated" } });
await scopedDb.program.delete({ where: { id } });
```

### Pattern 2: Relation-Scoped Models (manual filter)

Models without a direct `organizationId` must be filtered through their relation chain:

```typescript
// Payment → via invoice
const payments = await db.payment.findMany({
  where: { invoice: { organizationId: session.user.organizationId } },
});

// Enrollment → via program
const enrollments = await db.enrollment.findMany({
  where: { program: { organizationId: session.user.organizationId } },
});

// AthleteMembership → via instance → group
const memberships = await db.athleteMembership.findMany({
  where: { instance: { group: { organizationId: session.user.organizationId } } },
});

// Athlete (list) → via organizationAthletes
const athletes = await db.athlete.findMany({
  where: { organizationAthletes: { some: { organizationId } } },
});

// WaiverAcceptance → via waiver
const acceptances = await db.waiverAcceptance.findMany({
  where: { waiver: { organizationId: session.user.organizationId } },
});

// LineItem → via invoice
const lineItems = await db.lineItem.findMany({
  where: { invoice: { organizationId: session.user.organizationId } },
});
```

### Pattern 3: Mutations Inside Transactions

`getScopedDb` extensions do **not** propagate into `$transaction` callbacks. Add a defensive org check inside the transaction:

```typescript
const result = await db.$transaction(async (tx) => {
  // Verify ownership inside the transaction
  const record = await tx.program.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!record) throw new Error("Not found or access denied");

  // Safe to mutate — ownership verified atomically
  return tx.program.update({ where: { id }, data: updateData });
});
```

### Pattern 4: Public Endpoints (`/api/public/`)

Public endpoints serve users who may not be members of the target organization (e.g., a parent registering their child at a new club). `session.user.organizationId` would be wrong or empty in these cases. Use `resolvePublicRequest` to validate the client-provided `organizationId` against the Host header subdomain:

```typescript
import { resolvePublicRequest } from "@/lib/public-api";

// For GET — org from query params
const { searchParams } = new URL(request.url);
const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
if (result instanceof NextResponse) return result;
const { organizationId } = result;

// For POST — org from body
const body = await request.json();
const result = await resolvePublicRequest(request, body.organizationId);
if (result instanceof NextResponse) return result;
const { organizationId } = result;
```

`resolvePublicRequest` also applies rate limiting. If the endpoint accesses athlete data, add a `verifyGuardian` check to prevent IDOR:

```typescript
async function verifyGuardian(athleteId: string, email: string): Promise<boolean> {
  const guardian = await db.athleteGuardian.findFirst({
    where: { athleteId, user: { email } },
    select: { id: true },
  });
  return !!guardian;
}
```

### Anti-Pattern: Check-Then-Act

**Wrong** — verifies ownership then mutates without the filter:

```typescript
// BAD: race condition between check and mutation
const existing = await scopedDb.program.findFirst({ where: { id } });
if (!existing) return notFound();
await db.program.delete({ where: { id } }); // ← raw db, no org filter
```

**Right** — use `getScopedDb` for the mutation itself:

```typescript
const existing = await scopedDb.program.findFirst({ where: { id } });
if (!existing) return notFound();
await scopedDb.program.delete({ where: { id } }); // ← scopedDb enforces org
```

## Shared Data

`AthleteMedicalInfo` is intentionally **not** org-scoped — medical records are shared across organizations for athlete safety.

Guardian `User` records are also shared, but their associated data (invoices, payments, athletes) must be filtered by the current organization.

## Checklist for New API Routes

Before shipping a new route, verify:

- [ ] Session authentication is checked (`getAuthSession`)
- [ ] All `findMany` / `findFirst` / `count` calls are org-scoped
- [ ] Create operations set `organizationId` (auto if using `getScopedDb`)
- [ ] Update/delete operations use `getScopedDb` or include org in the where clause
- [ ] No client-provided `organizationId` is trusted (session for authenticated routes; `resolvePublicRequest` for `/api/public/`)
- [ ] Related-model queries filter through the org relation chain
- [ ] Transaction mutations include a defensive org check inside the callback
- [ ] Date-only fields use `parseDateOnly()` (see `.cursor/rules/date-handling.mdc`)
