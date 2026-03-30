import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

interface MonthlyTaxData {
  month: string;
  taxCollected: number;
  invoiceCount: number;
}

interface MonthlyFeeData {
  month: string;
  transactionCount: number;
  grossVolume: number;
  fees: number;
}

function formatMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const now = new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateParam ? new Date(endDateParam) : now;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid date parameters" }, { status: 400 });
    }

    if (endDate < startDate) {
      return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    const [invoices, transactions, org] = await Promise.all([
      db.invoice.findMany({
        where: {
          organizationId,
          status: "PAID",
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          tax: true,
          processingFee: true,
          createdAt: true,
        },
      }),
      db.transaction.findMany({
        where: {
          organizationId,
          status: "SETTLED",
          settledAt: { gte: startDate, lte: endDate },
        },
        select: {
          amount: true,
          settledAt: true,
          feeRate: true,
          feeFixed: true,
        },
      }),
      db.organization.findUnique({
        where: { id: organizationId },
        select: {
          subscription: {
            select: {
              plan: {
                select: {
                  transactionFee: true,
                  perTransactionFee: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const plan = org?.subscription?.plan;
    // Fallback rates for transactions created before fee snapshot was added
    const fallbackRate = plan ? Number(plan.transactionFee) : 0;
    const fallbackFixed = plan ? Number(plan.perTransactionFee) : 0;

    // Aggregate tax data by month
    const taxByMonth = new Map<string, { total: number; count: number }>();
    let totalTax = 0;

    for (const invoice of invoices) {
      const month = formatMonth(invoice.createdAt);
      const taxAmount = Number(invoice.tax);
      totalTax += taxAmount;

      const existing = taxByMonth.get(month) || { total: 0, count: 0 };
      existing.total += taxAmount;
      existing.count += 1;
      taxByMonth.set(month, existing);
    }

    // Aggregate fee data by month
    const feeByMonth = new Map<string, { count: number; volume: number; fees: number }>();
    let totalFees = 0;
    let totalVolume = 0;

    for (const txn of transactions) {
      if (!txn.settledAt) continue;
      const month = formatMonth(txn.settledAt);
      const amount = Number(txn.amount);
      const rate = txn.feeRate != null ? Number(txn.feeRate) : fallbackRate;
      const fixed = txn.feeFixed != null ? Number(txn.feeFixed) : fallbackFixed;
      const fee = amount * rate + fixed;
      totalFees += fee;
      totalVolume += amount;

      const existing = feeByMonth.get(month) || { count: 0, volume: 0, fees: 0 };
      existing.count += 1;
      existing.volume += amount;
      existing.fees += fee;
      feeByMonth.set(month, existing);
    }

    const taxMonthly: MonthlyTaxData[] = Array.from(taxByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        taxCollected: Math.round(data.total * 100) / 100,
        invoiceCount: data.count,
      }));

    const feeMonthly: MonthlyFeeData[] = Array.from(feeByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        transactionCount: data.count,
        grossVolume: Math.round(data.volume * 100) / 100,
        fees: Math.round(data.fees * 100) / 100,
      }));

    return NextResponse.json({
      tax: {
        total: Math.round(totalTax * 100) / 100,
        monthly: taxMonthly,
      },
      fees: {
        total: Math.round(totalFees * 100) / 100,
        totalVolume: Math.round(totalVolume * 100) / 100,
        transactionCount: transactions.length,
        monthly: feeMonthly,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch tax and fee report:", error);
    return NextResponse.json({ error: "Failed to fetch tax and fee report" }, { status: 500 });
  }
}
