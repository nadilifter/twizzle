# Data Table Migration Tracker

Tracks migration of all tables to the reusable `@/components/data-table` components.

## Migrated

| File | Route | Description |
|------|-------|-------------|
| `src/app/dashboard/competitions/[id]/athletes-tab.tsx` | `/dashboard/competitions/[id]` (Athletes tab) | Competition athletes list with search, sorting, pagination, column visibility |
| `src/app/dashboard/competitions/[id]/athletes/[athleteId]/page.tsx` | `/dashboard/competitions/[id]/athletes/[athleteId]` | Athlete event registrations with sortable columns |
| `src/app/dashboard/competitions/[id]/transactions-tab.tsx` | `/dashboard/competitions/[id]` (Transactions tab) | Competition transactions with sorting, pagination, column visibility |
| `src/app/dashboard/competitions/[id]/events-tab.tsx` | `/dashboard/competitions/[id]` (Events tab) | Competition events with sorting, pagination, column visibility |
| `src/app/dashboard/competitions/[id]/events/[categoryId]/page.tsx` | `/dashboard/competitions/[id]/events/[categoryId]` | Event category athletes with sorting, pagination, column visibility |
| `src/app/dashboard/financials/ledgers/gl-codes-table.tsx` | `/dashboard/financials/ledgers` | GL codes with sorting, pagination, column visibility, CSV import/export |
| `src/app/dashboard/financials/ledgers/ledger-transactions.tsx` | `/dashboard/financials/ledgers` | Ledger transactions (double-entry) with sorting, pagination, column visibility, export |
| `src/app/dashboard/athletes/page.tsx` | `/dashboard/athletes` | Athletes directory with sorting, pagination, column visibility, level/group/status filters |
| `src/app/dashboard/athletes/waivers/waiver-table.tsx` | `/dashboard/athletes/waivers` | Waivers list with sorting, pagination, column visibility |
| `src/app/dashboard/forms/surveys/survey-table.tsx` | `/dashboard/forms/surveys` | Surveys list with sorting, pagination, column visibility |
| `src/app/dashboard/financials/discounts/page.tsx` | `/dashboard/financials/discounts` | Discount codes/promotions with sorting, pagination, column visibility, row selection |
| `src/app/dashboard/organization/store/page.tsx` | `/dashboard/organization/store` | Store products/inventory with sorting, pagination, column visibility, category filter |
| `src/components/superadmin/users-table.tsx` | `/superadmin/users` | Superadmin user management with sorting, pagination, column visibility, role/org/status filters |
| `src/components/announcements-table.tsx` | `/dashboard/communication/announcements` | Announcements with sorting, pagination, column visibility, row selection |

## Needs Migration — Tables with Drag-and-Drop

These tables have `@dnd-kit` drag-and-drop row reordering. Migration should preserve DnD while adopting reusable sub-components where possible.

| # | File | Route | Description | Notes |
|---|------|-------|-------------|-------|
| 1 | `src/components/messages-table.tsx` | `/dashboard/communication/messages` | SMS messages | DnD row reorder |
| 2 | `src/components/emails-table.tsx` | `/dashboard/communication/emails` | Email campaigns | DnD row reorder |

## Not Migrating

| File | Reason |
|------|--------|
| `src/components/data-table.tsx` | Specialized DnD form builder table with tabs, charts, and sheet viewer. Serves a different purpose entirely. |

## Deleted (Removed)

| File | Reason |
|------|--------|
| `src/app/campaigns/advertising/page.tsx` | Placeholder page with hardcoded data — deleted |
| `src/app/campaigns/donation/page.tsx` | Placeholder page with hardcoded data — deleted |
| `src/app/campaigns/sponsorship/page.tsx` | Placeholder page with hardcoded data — deleted |
| `src/app/campaigns/merchandise/page.tsx` | Placeholder page with hardcoded data — deleted |

## Migration Steps

For each table:

1. Replace static `header: "Name"` strings with `header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />`
2. Replace custom pagination markup with `<DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />`
3. Add `<DataTableViewOptions table={table} />` to toolbar area (optional, for tables with many columns)
4. Add `columnVisibility` state and `onColumnVisibilityChange` to `useReactTable` config
5. Wrap `<Table>` in `<div className="overflow-hidden rounded-md border">`
6. Use default `CardContent` padding — remove `p-0` overrides
7. Add `data-state={row.getIsSelected() && "selected"}` to `<TableRow>` if row selection is enabled
8. Add "No results." empty `<TableRow>` for when filters return zero matches
9. Set default page size to 20
