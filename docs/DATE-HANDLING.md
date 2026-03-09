# Date Handling Guide

This document explains how date-only fields are handled in the Uplifter codebase to prevent timezone-related display bugs.

## The Problem

Many fields in the application represent calendar dates without a time component — birth dates, start dates, due dates, etc. These are stored as `DateTime` values in PostgreSQL (via Prisma).

When a user enters `2026-01-23` and the application stores it using `new Date("2026-01-23")`, JavaScript creates `2026-01-23T00:00:00.000Z` (midnight UTC). When this value is later displayed in a timezone west of UTC — for example `America/New_York` (UTC-5) — the local time resolves to `2026-01-22T19:00:00` and date formatting shows **January 22** instead of **January 23**.

## The Solution: Noon UTC

All date-only values are stored at **noon UTC** (`12:00:00.000Z`). Noon UTC is safe for every timezone from UTC-12 (Baker Island) to UTC+14 (Line Islands), because shifting by up to 14 hours in either direction never crosses a date boundary.

```
Input:    "2026-01-23"
Stored:   2026-01-23T12:00:00.000Z
UTC-12:   2026-01-23T00:00  ✓
UTC+14:   2026-01-24T02:00  — but toLocaleDateString still shows Jan 23 ✓
```

This approach matches the pattern used by other open-source projects including [Vite](https://github.com/vitejs/vite), [Vitest](https://github.com/vitest-dev/vitest), and [Wealthfolio](https://github.com/afadil/wealthfolio).

## Utilities

All date utilities live in [`src/lib/date-utils.ts`](../src/lib/date-utils.ts):

| Function | Signature | Purpose |
|---|---|---|
| `parseDateOnly` | `(str: string \| null) => Date \| null` | Parse a `YYYY-MM-DD` string to noon UTC. Falls back to `new Date()` for ISO datetime strings. |
| `normalizeToNoonUTC` | `(date: Date \| null) => Date \| null` | Shift an existing Date to noon UTC. Useful for fixing legacy midnight-UTC data. |
| `formatDateOnly` | `(date: Date \| string \| null, tz?: string) => string` | Format a Date as `YYYY-MM-DD`, optionally in a specific timezone. |
| `getTodayNoonUTC` | `() => Date` | Returns today's date at noon UTC. |
| `isSameDay` | `(d1: Date, d2: Date) => boolean` | Compare two dates by calendar day in UTC. |

## Correct Patterns

### API Routes

```typescript
import { parseDateOnly } from "@/lib/date-utils";

// Creating a record with a date-only field
startDate: parseDateOnly(validatedData.startDate)!,

// Optional date field
endDate: validatedData.endDate ? parseDateOnly(validatedData.endDate) : null,

// Conditional update
date: validatedData.date ? parseDateOnly(validatedData.date) ?? undefined : undefined,
```

### Seed Files

```typescript
function noonUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

birthDate: noonUTC("2016-03-15"),
```

### Frontend — Displaying Dates from the Database

```typescript
// Safe: construct from ISO string (already noon UTC from DB)
format(new Date(event.date), "MMM d, yyyy")

// Safe: construct with explicit noon UTC for display
const dateObj = new Date(dateString + "T12:00:00Z");
format(dateObj, "EEE, MMM d, yyyy")
```

### Frontend — `<input type="date">` Handlers

```typescript
// Preferred: keep as string, let the API route parse
onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}

// Alternative: construct noon UTC client-side
onChange={e => {
  const [y, m, d] = e.target.value.split("-").map(Number);
  setFormData(prev => ({
    ...prev,
    startDate: new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))
  }));
}}
```

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---|---|---|
| `new Date("2026-01-23")` | Creates midnight UTC — shifts in western timezones | `parseDateOnly("2026-01-23")` |
| `new Date(e.target.value)` | Same as above — `<input type="date">` yields `YYYY-MM-DD` | Use noon UTC or keep as string |
| `new Date(str + "T00:00:00")` | Creates midnight local time — inconsistent across timezones | `new Date(str + "T12:00:00Z")` |
| `date.toISOString().split("T")[0]` | Only safe when the stored value is at noon UTC | Use `formatDateOnly(date)` |

## Date-Only vs. Datetime Fields

### Date-only fields (use `parseDateOnly`)

`birthDate`, `startDate`, `endDate`, `dueDate`, `hireDate`, `date` (on events, shifts, evaluations, lesson plans, ledger entries), `validFrom`, `validTo`, `purchaseDate`, `lastInspectionDate`, `autoRenewDate`, `targetDate`, `nextChargeDate`, `scheduledGoLiveDate`

### True datetime fields (use `new Date()` as-is)

`createdAt`, `updatedAt`, `lastActiveAt`, `scheduledAt` (email/SMS campaigns), `checkedIn`, `settledAt`, `paidAt`, `lastChargedAt`, `expiresAt` (sessions/tokens), `smsOptOutAt`, `emailOptOutAt`

## Legacy Data

Existing records may have midnight UTC values from before this convention was adopted. Use `normalizeToNoonUTC()` from `date-utils.ts` to fix individual records, or run a migration to normalize all date-only fields in bulk.
