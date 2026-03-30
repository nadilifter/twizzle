import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createGLCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["REVENUE", "EXPENSE", "LIABILITY", "ASSET", "EQUITY"]),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

const updateGLCodeSchema = z.object({
  description: z.string().optional(),
  type: z.enum(["REVENUE", "EXPENSE", "LIABILITY", "ASSET", "EQUITY"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// GET /api/ledgers - List GL codes
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    const [glCodes, total] = await Promise.all([
      db.gLCode.findMany({
        where,
        include: {
          _count: {
            select: {
              ledgerEntries: true,
            },
          },
        },
        orderBy: { code: "asc" },
        take: limit,
        skip: offset,
      }),
      db.gLCode.count({ where }),
    ]);

    // Get balance summaries from ledger entries (manual journal entries)
    const balancesByType = await db.ledgerEntry.groupBy({
      by: ["glCodeId"],
      where: {
        organizationId: session.user.organizationId,
        status: "POSTED",
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    // Get line item revenue totals per GL code (from actual transactions)
    const lineItemTotals = await db.lineItem.groupBy({
      by: ["glCodeId"],
      where: {
        glCodeId: { not: null },
        invoice: { organizationId: session.user.organizationId },
      },
      _sum: { total: true },
      _count: true,
    });
    const lineItemMap = new Map(
      lineItemTotals.map((li) => [
        li.glCodeId,
        { total: Number(li._sum.total || 0), count: li._count },
      ])
    );

    // Get monthly revenue data for the current year (from line items)
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const monthlyRevenue: Array<{ month: Date; total: unknown }> = await db.$queryRaw`
      SELECT DATE_TRUNC('month', i."createdAt") as month, SUM(li.total) as total
      FROM "LineItem" li
      JOIN "Invoice" i ON li."invoiceId" = i.id
      WHERE i."organizationId" = ${session.user.organizationId}
        AND i."createdAt" >= ${yearStart}
      GROUP BY DATE_TRUNC('month', i."createdAt")
      ORDER BY month ASC
    `;

    // Map balances to GL codes
    const codesWithBalances = glCodes.map((glCode) => {
      const balance = balancesByType.find((b) => b.glCodeId === glCode.id);
      const debitTotal = Number(balance?._sum.debit || 0);
      const creditTotal = Number(balance?._sum.credit || 0);
      const lineItemData = lineItemMap.get(glCode.id);

      return {
        ...glCode,
        entryCount: glCode._count.ledgerEntries,
        debitTotal,
        creditTotal,
        balance: debitTotal - creditTotal,
        lineItemTotal: lineItemData?.total || 0,
        lineItemCount: lineItemData?.count || 0,
      };
    });

    // Calculate summary stats
    const stats = {
      totalRevenue: 0,
      totalExpenses: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
    };

    // Revenue stats from line items (real transaction data)
    const revenueByCode: Array<{ id: string; code: string; description: string; amount: number }> =
      [];

    for (const code of codesWithBalances) {
      if (code.type === "REVENUE") {
        const amount = code.lineItemTotal;
        stats.totalRevenue += amount;
        if (amount > 0) {
          revenueByCode.push({
            id: code.id,
            code: code.code,
            description: code.description,
            amount,
          });
        }
      }

      // Ledger entry balances for other account types
      const balance = code.balance;
      switch (code.type) {
        case "EXPENSE":
          stats.totalExpenses += balance;
          break;
        case "ASSET":
          stats.totalAssets += balance;
          break;
        case "LIABILITY":
          stats.totalLiabilities += Math.abs(balance);
          break;
        case "EQUITY":
          stats.totalEquity += balance;
          break;
      }
    }

    return NextResponse.json({
      data: codesWithBalances,
      total,
      limit,
      offset,
      stats,
      revenueByCode,
      monthlyRevenue: monthlyRevenue.map((m) => ({
        month: m.month,
        total: Number(m.total || 0),
      })),
    });
  } catch (error) {
    console.error("Error fetching GL codes:", error);
    return NextResponse.json({ error: "Failed to fetch GL codes" }, { status: 500 });
  }
}

// POST /api/ledgers - Create GL code
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createGLCodeSchema.parse(body);

    // Check if code already exists
    const existing = await db.gLCode.findFirst({
      where: {
        code: validatedData.code,
        organizationId: session.user.organizationId,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "GL code already exists" }, { status: 409 });
    }

    const glCode = await db.gLCode.create({
      data: {
        organizationId: session.user.organizationId,
        code: validatedData.code,
        description: validatedData.description,
        type: validatedData.type,
        status: validatedData.status,
      },
    });

    return NextResponse.json(glCode);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating GL code:", error);
    return NextResponse.json({ error: "Failed to create GL code" }, { status: 500 });
  }
}

// PATCH /api/ledgers - Update GL code
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.write")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const validatedData = updateGLCodeSchema.parse(updateData);

    const glCode = await db.gLCode.update({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      data: validatedData,
    });

    return NextResponse.json(glCode);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating GL code:", error);
    return NextResponse.json({ error: "Failed to update GL code" }, { status: 500 });
  }
}

// DELETE /api/ledgers - Delete GL code
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Check if GL code is a system default
    const glCode = await db.gLCode.findFirst({
      where: { id, organizationId: session.user.organizationId },
      select: { isDefault: true },
    });

    if (glCode?.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete a default GL code. You can deactivate it instead." },
        { status: 400 }
      );
    }

    // Check if GL code has any entries
    const hasEntries = await db.ledgerEntry.count({
      where: { glCodeId: id, organizationId: session.user.organizationId },
    });

    if (hasEntries > 0) {
      return NextResponse.json(
        { error: "Cannot delete GL code with existing entries. Mark it as inactive instead." },
        { status: 400 }
      );
    }

    await db.gLCode.delete({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting GL code:", error);
    return NextResponse.json({ error: "Failed to delete GL code" }, { status: 500 });
  }
}
