# N+1 Query Fix Plan

## Problem

Two services build per-recipient context inside a loop, issuing multiple sequential DB
queries for each recipient. This compounds badly at scale:

| Service                     | Queries per recipient | 1,000-recipient campaign                         |
| --------------------------- | --------------------- | ------------------------------------------------ |
| `email-campaign-service.ts` | ~8                    | ~8,000 sequential queries + 50s artificial delay |
| `notification-service.ts`   | ~2                    | ~2,000 sequential queries                        |

Both follow the same pattern: fetch a recipient list, then loop and call a context-builder
function per entry that hits the DB individually.

---

## Files to Change

- `src/lib/email-campaign-service.ts`
- `src/lib/notification-service.ts`

---

## Fix: `email-campaign-service.ts`

### Current pattern (lines 1128–1162)

```ts
for (const recipient of recipients) {
  const context = recipient.userId
    ? await buildRecipientContext(campaign.organizationId, recipient.userId)
    : { ... };
  // render and send
  await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms per email
}
```

### `buildRecipientContext` queries (lines 984–1075)

Per-recipient calls inside the loop:

1. `db.organization.findUnique()` — same org for every recipient
2. `db.user.findUnique()` with includes for `memberships`, `guardians`, `athletes`
3. Several conditional lookups depending on user type

### Fix approach

**Step 1 — Hoist the org lookup out of the loop**

`organization` is the same for every recipient. Fetch it once before the loop and pass it in.

```ts
const organization = await db.organization.findUnique({
  where: { id: campaign.organizationId },
  select: { name: true, slug: true, /* ... */ },
});

for (const recipient of recipients) { ... }
```

**Step 2 — Batch-fetch all recipient users before the loop**

```ts
const userIds = recipients.map((r) => r.userId).filter(Boolean) as string[];

const users = await db.user.findMany({
  where: { id: { in: userIds } },
  select: {
    id: true,
    name: true,
    email: true,
    memberships: { include: { organization: true } },
    // any other fields buildRecipientContext currently fetches
  },
});

const userMap = new Map(users.map((u) => [u.id, u]));
```

**Step 3 — Replace `buildRecipientContext` with a sync lookup**

```ts
function buildRecipientContextFromData(
  organization: OrgData,
  user: UserWithIncludes | undefined,
  recipient: Recipient
): RecipientContext {
  // pure data transformation, no DB calls
}
```

**Step 4 — Remove the artificial 50ms delay**

The 50ms `setTimeout` per email (line 1162) was likely added to throttle SES. Replace with
SES's native rate limiting or a proper queue. At minimum, batch the delay:

```ts
// After every 10 sends, pause briefly if needed
if (i % 10 === 0) await new Promise((r) => setTimeout(r, 100));
```

---

## Fix: `notification-service.ts`

### Current pattern (lines 813–953)

```ts
for (const recipient of recipients) {
  const user = await db.user.findUnique({
    // per-recipient DB call
    where: { id: recipient.userId },
  });
  // build context, send notification
}
```

### Fix approach

Same structure as the email fix — batch-fetch before the loop:

```ts
const userIds = recipients.map((r) => r.userId).filter(Boolean) as string[];

const users = await db.user.findMany({
  where: { id: { in: userIds } },
  select: { id: true, name: true, email: true /* fields needed for context */ },
});

const userMap = new Map(users.map((u) => [u.id, u]));

for (const recipient of recipients) {
  const user = userMap.get(recipient.userId);
  // proceed with sync lookup, no DB call
}
```

---

## Additional Index to Add

The exploration also found that the **event attendance query** in `email-campaign-service.ts`
(lines 677–698) lacks an `organizationId` filter, meaning it could theoretically return
data across orgs. While the route is authenticated, it's worth adding a defensive filter.

Also, `InstanceRegistration` is missing `@@index([organizationId])` which is used in
the `PROGRAM_ANY_INSTANCE` targeting path.

Schema additions to make alongside this work:

```prisma
// InstanceRegistration — add to model
@@index([organizationId])

// Attendance — add to model
@@index([organizationId])
@@index([organizationId, eventId])
```

---

## Testing

After implementing:

1. Run a test email campaign to a list of 50+ recipients and verify total DB query count
   drops from `recipients × 8` to `~5 total` (org + batch user fetch + send tracking).
2. Confirm notification delivery still works end-to-end for all recipient types
   (`ALL_GUARDIANS`, `PROGRAM_MEMBERS`, `MEMBERSHIP_HOLDERS`, `INTERNAL_USERS`).
3. Check that removing the per-email 50ms delay doesn't cause SES rate limit errors —
   monitor SES send rate in CloudWatch after deploy.
