# Database Seeding Guide

This document describes how to seed the database with development data for testing and local development.

## Quick Start

```bash
# Run the development seed script
pnpm db:seed:dev

# Or reset the database and seed in one command
pnpm db:reset
```

## Available Scripts

| Script             | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `pnpm db:seed`     | Run the default Prisma seed (minimal production data)  |
| `pnpm db:seed:dev` | Run the comprehensive development seed with dummy data |
| `pnpm db:reset`    | Reset the database and run the development seed        |

## What Gets Created

The development seed (`seed-dev.ts`) creates two complete organizations with realistic data:

### Organizations

| Organization               | Slug                 | Focus                 | Subscription      |
| -------------------------- | -------------------- | --------------------- | ----------------- |
| Sunrise Gymnastics Academy | `sunrise-gymnastics` | Youth gymnastics club | Gold (yearly)     |
| Metro Sports Complex       | `metro-sports`       | Multi-sport facility  | Starter (monthly) |

### Data Summary

| Model          | Sunrise Gym                      | Metro Sports                |
| -------------- | -------------------------------- | --------------------------- |
| Users          | 5 (admin, 3 coaches, accountant) | 3 (admin, coach, volunteer) |
| Families       | 5                                | 4                           |
| Athletes       | 8                                | 6                           |
| Programs       | 5                                | 4                           |
| Events         | 5                                | 4                           |
| Invoices       | 3                                | 2                           |
| Products (POS) | 4                                | 3                           |
| Skills         | 5                                | 4                           |

### Test Accounts

Seed accounts are created **without passwords**. Use email-based login (magic link / login code) to sign in during local development.

| Email                                | Role       | Organization       |
| ------------------------------------ | ---------- | ------------------ |
| `admin@sunrise-gymnastics.com`       | Admin      | Sunrise Gymnastics |
| `coach.maria@sunrise-gymnastics.com` | Coach      | Sunrise Gymnastics |
| `coach.james@sunrise-gymnastics.com` | Coach      | Sunrise Gymnastics |
| `coach.ava@sunrise-gymnastics.com`   | Coach      | Sunrise Gymnastics |
| `finance@sunrise-gymnastics.com`     | Accountant | Sunrise Gymnastics |
| `admin@metro-sports.com`             | Admin      | Metro Sports       |
| `coach.sarah@metro-sports.com`       | Coach      | Metro Sports       |
| `volunteer@metro-sports.com`         | Volunteer  | Metro Sports       |

## Adyen Test Accounts

Both seeded organizations are fully onboarded with Adyen (VERIFIED, all capabilities enabled) and map to real accounts in the **Adyen TEST environment** (`UplifterLLC` balance platform).

| Organization       | Account Holder ID           | Balance Account ID          | Payout Schedule |
| ------------------ | --------------------------- | --------------------------- | --------------- |
| Sunrise Gymnastics | `AH3292V22322BK5P8Z8364KJM` | `BA3292V22322BK5P8Z8374KKP` | weekly          |
| Metro Sports       | `AH3292V22322BK5P8Z5ZF4DWF` | `BA3297R22322BK5P8Z5ZG2LCQ` | daily           |

Both orgs have a store, split configuration, sweep, and linked transfer instrument — all required for B2C payments with platform fee splits and manual payout initiation.

### Transaction and payout history sync

The seed script automatically syncs real transaction and payout history from Adyen's Transfers API at the end of `pnpm db:seed:dev`. This means the financials dashboard shows accurate data without requiring live webhook events after seeding.

**Prerequisite — Transfers read permission:**
The `ADYEN_PLATFORM_API_KEY` credential (`ws_508000@BalancePlatform.UplifterLLC`) must have the **"Balance Platform Transfers read"** role enabled. To add it:

1. Log in to [https://ca-test.adyen.com](https://ca-test.adyen.com)
2. Go to **Balance Platforms → UplifterLLC → Developers → API credentials**
3. Open `ws_508000@BalancePlatform.UplifterLLC`
4. Under **Permissions**, enable **Balance Platform Transfers read** (or the equivalent Transfers API read role)
5. Click **Save changes**

If this permission is missing, the seed will print a `⚠` warning and skip the sync — the `AdyenPlatformAccount` records are still created correctly; only the transaction/payout history will be empty.

**What is synced:**

- `Transaction` records from `platformPayment` category transfers (net amounts credited to each org's balance account). Note: card brand/method (`visa`, `mc`) is **not available** from the Balance Platform Transfers API and will be `null` on synced records — it is only present in the standard payment webhook notification.
- `Payout` records from `bank` category transfers (sweeps to the linked bank account)
- Settled transactions are linked to their corresponding paid payouts

To verify payments in the Adyen Customer Area:

1. Log in to [https://ca-test.adyen.com](https://ca-test.adyen.com)
2. Navigate to **Balance Platforms → UplifterLLC → Account Holders**
3. Search by the account holder ID above to see transactions, balance, and payout history

> These IDs exist in the Adyen TEST environment only. Do not use them in production. If you run `pnpm db:reset`, the seed will restore these exact IDs and re-sync Adyen history automatically.

## Platform Subscription Plans

The seed also creates platform-level subscription plans:

| Plan     | Monthly | Yearly | Athletes  | Users     |
| -------- | ------- | ------ | --------- | --------- |
| Free     | $0      | $0     | 25        | 2         |
| Starter  | $49     | $470   | 100       | 5         |
| Gold     | $149    | $1,430 | 500       | 15        |
| Platinum | $349    | $3,350 | Unlimited | Unlimited |

## Maintaining the Seed Script

### Adding New Models

When you add a new model to `schema.prisma`:

1. Add a new section to `prisma/seed-dev.ts`
2. Follow the existing patterns:
   - Use deterministic IDs prefixed with org slug (e.g., `${ORG1_ID}-newmodel-1`)
   - Use `upsert` for idempotent seeding
   - Create data for both organizations
3. Update the summary output at the end of the script
4. Update this documentation

### ID Conventions

All seed IDs follow this pattern for easy identification and conflict-free re-running:

```typescript
// Organization IDs
const ORG1_ID = "seed-org-sunrise";
const ORG2_ID = "seed-org-metro";

// Entity IDs follow the pattern: {org-id}-{entity-type}-{number}
// Examples:
// seed-org-sunrise-ath-1   (athlete)
// seed-org-metro-evt-2     (event)
// seed-org-sunrise-inv-3   (invoice)
```

### Date Helpers

The script provides helper functions for generating dates:

```typescript
daysFromNow(30); // 30 days in the future
daysAgo(15); // 15 days in the past
```

## Troubleshooting

### "Unique constraint failed"

This usually means you have conflicting data. Solutions:

1. Run `pnpm db:reset` to start fresh
2. Check that your IDs don't conflict with existing data

### "Foreign key constraint failed"

Entities are created in dependency order. If you're adding new seed data:

1. Ensure parent entities are created before children
2. Check that all referenced IDs exist

### Slow Seeding

The seed script uses `Promise.all()` where possible for parallel operations. If it's still slow:

1. Check your database connection
2. Consider batching large inserts

## File Structure

```
prisma/
├── schema.prisma       # Database schema
├── seed.ts             # Default/production seed (minimal)
├── seed-dev.ts         # Development seed (comprehensive)
├── seed-reserved.ts    # Reserved domains seed
└── migrations/         # Migration history
```

## See Also

- [Prisma Seeding Documentation](https://www.prisma.io/docs/guides/database/seed-database)
- [schema.prisma](../prisma/schema.prisma) - Database schema reference
