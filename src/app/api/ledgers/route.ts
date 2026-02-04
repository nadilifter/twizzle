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

    // Get balance summaries by type
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

    // Map balances to GL codes
    const codesWithBalances = glCodes.map((glCode) => {
      const balance = balancesByType.find((b) => b.glCodeId === glCode.id);
      const debitTotal = Number(balance?._sum.debit || 0);
      const creditTotal = Number(balance?._sum.credit || 0);
      
      return {
        ...glCode,
        entryCount: glCode._count.ledgerEntries,
        debitTotal,
        creditTotal,
        balance: debitTotal - creditTotal,
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

    for (const code of codesWithBalances) {
      const balance = code.balance;
      switch (code.type) {
        case "REVENUE":
          stats.totalRevenue += Math.abs(balance);
          break;
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
    });
  } catch (error) {
    console.error("Error fetching GL codes:", error);
    return NextResponse.json(
      { error: "Failed to fetch GL codes" },
      { status: 500 }
    );
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
    const existing = await db.gLCode.findUnique({
      where: { code: validatedData.code },
    });

    if (existing) {
      return NextResponse.json(
        { error: "GL code already exists" },
        { status: 409 }
      );
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
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating GL code:", error);
    return NextResponse.json(
      { error: "Failed to create GL code" },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating GL code:", error);
    return NextResponse.json(
      { error: "Failed to update GL code" },
      { status: 500 }
    );
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

    // Check if GL code has any entries
    const hasEntries = await db.ledgerEntry.count({
      where: { glCodeId: id },
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
    return NextResponse.json(
      { error: "Failed to delete GL code" },
      { status: 500 }
    );
  }
}
