import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";

// GET /api/analytics/revenue
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;

    const gate = await checkFeatureGate(orgId, "analytics");
    if (gate) return gate;

    const scopedDb = getScopedDb(orgId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      revenueThisMonth,
      revenueLastMonth,
      outstandingResult,
      recurringRevenueResult,
      totalNonDraftInvoices,
      paidInvoices,
      revenueTrend,
      revenueByCategory,
      paymentMethods,
      invoicesByStatus,
    ] = await Promise.all([
      // KPI: revenue this month (sum of completed payments)
      db.$queryRaw<{ total: number | null }[]>`
        SELECT COALESCE(SUM(p."amount"), 0)::numeric AS total
        FROM "Payment" p
        INNER JOIN "Invoice" i ON p."invoiceId" = i."id"
        WHERE i."organizationId" = ${orgId}
          AND p."status" = 'COMPLETED'
          AND p."processedAt" >= ${monthStart}
      `,

      // KPI: revenue last month (for comparison)
      db.$queryRaw<{ total: number | null }[]>`
        SELECT COALESCE(SUM(p."amount"), 0)::numeric AS total
        FROM "Payment" p
        INNER JOIN "Invoice" i ON p."invoiceId" = i."id"
        WHERE i."organizationId" = ${orgId}
          AND p."status" = 'COMPLETED'
          AND p."processedAt" >= ${lastMonthStart}
          AND p."processedAt" < ${monthStart}
      `,

      // KPI: outstanding invoices total
      db.$queryRaw<{ total: number | null }[]>`
        SELECT COALESCE(SUM(i."total"), 0)::numeric AS total
        FROM "Invoice" i
        WHERE i."organizationId" = ${orgId}
          AND i."status" IN ('SENT', 'OVERDUE', 'PARTIAL')
      `,

      // KPI: monthly recurring revenue (normalize yearly to monthly)
      db.$queryRaw<{ total: number | null }[]>`
        SELECT COALESCE(SUM(
          CASE
            WHEN rc."frequency" = 'YEARLY' THEN rc."amount" / 12
            WHEN rc."frequency" = 'SESSION' THEN rc."amount"
            ELSE rc."amount"
          END
        ), 0)::numeric AS total
        FROM "RecurringCharge" rc
        WHERE rc."organizationId" = ${orgId}
          AND rc."status" = 'ACTIVE'
      `,

      // KPI: collection rate - total non-draft invoices
      scopedDb.invoice.count({
        where: { status: { notIn: ["DRAFT"] } },
      }),

      // KPI: collection rate - paid invoices
      scopedDb.invoice.count({
        where: { status: "PAID" },
      }),

      // Revenue trend: monthly completed payments over 12 months
      db.$queryRaw<{ month: string; total: number }[]>`
        WITH months AS (
          SELECT to_char(d, 'YYYY-MM') AS month
          FROM generate_series(
            date_trunc('month', NOW()) - INTERVAL '11 months',
            date_trunc('month', NOW()),
            '1 month'
          ) d
        )
        SELECT m.month,
               COALESCE(SUM(p."amount"), 0)::numeric AS total
        FROM months m
        LEFT JOIN "Payment" p ON to_char(p."processedAt", 'YYYY-MM') = m.month
          AND p."status" = 'COMPLETED'
          AND p."invoiceId" IN (
            SELECT i."id" FROM "Invoice" i WHERE i."organizationId" = ${orgId}
          )
        GROUP BY m.month
        ORDER BY m.month ASC
      `,

      // Revenue by category via LineItem foreign keys
      db.$queryRaw<{ category: string; total: number }[]>`
        SELECT
          CASE
            WHEN li."programId" IS NOT NULL THEN 'Programs'
            WHEN li."eventId" IS NOT NULL THEN 'Events'
            WHEN li."membershipInstanceId" IS NOT NULL THEN 'Memberships'
            WHEN li."passId" IS NOT NULL THEN 'Passes'
            WHEN li."productId" IS NOT NULL THEN 'Merchandise'
            WHEN li."competitionId" IS NOT NULL THEN 'Competitions'
            ELSE 'Other'
          END AS category,
          COALESCE(SUM(li."total"), 0)::numeric AS total
        FROM "LineItem" li
        INNER JOIN "Invoice" i ON li."invoiceId" = i."id"
        WHERE i."organizationId" = ${orgId}
          AND i."status" = 'PAID'
        GROUP BY 1
        ORDER BY total DESC
      `,

      // Payment method breakdown
      db.$queryRaw<{ method: string; count: number }[]>`
        SELECT p."method"::text AS method, COUNT(*)::int AS count
        FROM "Payment" p
        INNER JOIN "Invoice" i ON p."invoiceId" = i."id"
        WHERE i."organizationId" = ${orgId}
          AND p."status" = 'COMPLETED'
        GROUP BY p."method"
        ORDER BY count DESC
      `,

      // Invoice status breakdown
      db.$queryRaw<{ status: string; count: number }[]>`
        SELECT i."status"::text AS status, COUNT(*)::int AS count
        FROM "Invoice" i
        WHERE i."organizationId" = ${orgId}
        GROUP BY i."status"
        ORDER BY count DESC
      `,
    ]);

    const thisMonthRevenue = Number(revenueThisMonth[0]?.total ?? 0);
    const lastMonthRevenue = Number(revenueLastMonth[0]?.total ?? 0);
    const collectionRate = totalNonDraftInvoices > 0
      ? Math.round((paidInvoices / totalNonDraftInvoices) * 100)
      : 0;

    return NextResponse.json({
      kpis: {
        revenueThisMonth: thisMonthRevenue,
        revenueLastMonth: lastMonthRevenue,
        outstanding: Number(outstandingResult[0]?.total ?? 0),
        recurringRevenue: Number(recurringRevenueResult[0]?.total ?? 0),
        collectionRate,
        totalInvoices: totalNonDraftInvoices,
        paidInvoices,
      },
      revenueTrend: revenueTrend.map((row) => ({
        month: row.month,
        total: Number(row.total),
      })),
      revenueByCategory: revenueByCategory
        .filter((row) => Number(row.total) > 0)
        .map((row) => ({
          category: row.category,
          total: Number(row.total),
        })),
      paymentMethods: paymentMethods.map((row) => ({
        method: row.method,
        count: Number(row.count),
      })),
      invoicesByStatus: invoicesByStatus.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
    });
  } catch (error) {
    console.error("Error fetching revenue analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
