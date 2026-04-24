import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getBalanceAccountBalance,
  listBalanceAccountTransfers,
  isPlatformConfigured,
} from "@/lib/adyen-platform";

/**
 * GET /api/superadmin/organizations/[id]/adyen-balance
 * Returns live balance + recent transfers (last 30d, all categories) for an org's
 * Adyen balance account. Useful for verifying that split-configured payments have
 * booked into the connected account.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isPlatformConfigured()) {
      return NextResponse.json({ error: "Adyen platform is not configured" }, { status: 500 });
    }

    const { id } = await params;
    const account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: id },
      select: { balanceAccountId: true },
    });

    if (!account?.balanceAccountId) {
      return NextResponse.json(
        { error: "No balance account found for this organization" },
        { status: 404 }
      );
    }

    const createdSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [balance, transfersRaw] = await Promise.all([
      getBalanceAccountBalance(account.balanceAccountId),
      listBalanceAccountTransfers(account.balanceAccountId, {
        createdSince,
        category: "all",
      }),
    ]);

    const transfers = transfersRaw
      .map((t: any) => ({
        id: t.id,
        creationDate: t.creationDate,
        category: t.category,
        direction: t.direction,
        status: t.status,
        amount: t.amount,
        reference: t.reference,
        description: t.description,
        counterpartyDescription:
          t.counterparty?.merchantAccount ||
          t.counterparty?.bankAccount?.accountHolder?.fullName ||
          t.counterparty?.balanceAccountId ||
          null,
      }))
      .sort(
        (a, b) => new Date(b.creationDate ?? 0).getTime() - new Date(a.creationDate ?? 0).getTime()
      );

    return NextResponse.json({
      balanceAccountId: account.balanceAccountId,
      balance,
      transfers,
      windowDays: 30,
    });
  } catch (error: any) {
    console.error("Failed to fetch Adyen balance diagnostics:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch balance diagnostics" },
      { status: 500 }
    );
  }
}
