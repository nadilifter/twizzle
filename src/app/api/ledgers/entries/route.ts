import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const createLedgerEntrySchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    description: z.string().min(1, "Description is required"),
    glCodeId: z.string().min(1, "GL code is required"),
    reference: z.string().optional(),
    debit: z.number().optional(),
    credit: z.number().optional(),
    status: z.enum(["POSTED", "PENDING"]).default("PENDING"),
  })
  .refine(
    (data) =>
      (data.debit !== undefined && data.debit > 0) ||
      (data.credit !== undefined && data.credit > 0),
    { message: "Either debit or credit must be provided" }
  );

const createJournalEntrySchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    description: z.string().min(1, "Description is required"),
    reference: z.string().optional(),
    entries: z
      .array(
        z.object({
          glCodeId: z.string().min(1),
          debit: z.number().optional(),
          credit: z.number().optional(),
        })
      )
      .min(2, "At least two entries are required"),
    status: z.enum(["POSTED", "PENDING"]).default("PENDING"),
  })
  .refine(
    (data) => {
      const totalDebits = data.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
      const totalCredits = data.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
      return Math.abs(totalDebits - totalCredits) < 0.01; // Allow for floating point errors
    },
    { message: "Debits and credits must balance" }
  );

// GET /api/ledgers/entries - List ledger entries
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const glCodeId = searchParams.get("glCodeId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
      ];
    }

    if (glCodeId) {
      where.glCodeId = glCodeId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = {
        gte: new Date(startDate),
      };
    } else if (endDate) {
      where.date = {
        lte: new Date(endDate),
      };
    }

    const [entries, total] = await Promise.all([
      db.ledgerEntry.findMany({
        where,
        include: {
          glCode: {
            select: {
              id: true,
              code: true,
              description: true,
              type: true,
            },
          },
        },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      db.ledgerEntry.count({ where }),
    ]);

    // Calculate totals
    const totals = await db.ledgerEntry.aggregate({
      where: {
        organizationId: session.user.organizationId,
        status: "POSTED",
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    return NextResponse.json({
      data: entries,
      total,
      limit,
      offset,
      stats: {
        totalDebits: totals._sum.debit || 0,
        totalCredits: totals._sum.credit || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching ledger entries:", error);
    return NextResponse.json({ error: "Failed to fetch ledger entries" }, { status: 500 });
  }
}

// POST /api/ledgers/entries - Create ledger entry or journal entry
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

    // Check if this is a journal entry (multiple entries)
    if (body.entries && Array.isArray(body.entries)) {
      const validatedData = createJournalEntrySchema.parse(body);

      // Verify all GL codes exist
      const glCodeIds = Array.from(new Set(validatedData.entries.map((e) => e.glCodeId)));
      const existingCodes = await db.gLCode.findMany({
        where: {
          id: { in: glCodeIds },
          organizationId: session.user.organizationId,
        },
      });

      if (existingCodes.length !== glCodeIds.length) {
        return NextResponse.json({ error: "One or more GL codes not found" }, { status: 404 });
      }

      // Create all entries in a transaction
      const entries = await db.$transaction(
        validatedData.entries.map((entry) =>
          db.ledgerEntry.create({
            data: {
              organizationId: session.user.organizationId,
              date: parseDateOnly(validatedData.date)!,
              description: validatedData.description,
              reference: validatedData.reference,
              glCodeId: entry.glCodeId,
              debit: entry.debit,
              credit: entry.credit,
              status: validatedData.status,
            },
            include: {
              glCode: true,
            },
          })
        )
      );

      return NextResponse.json({
        message: "Journal entry created",
        entries,
      });
    }

    // Single entry
    const validatedData = createLedgerEntrySchema.parse(body);

    // Verify GL code exists
    const glCode = await db.gLCode.findFirst({
      where: {
        id: validatedData.glCodeId,
        organizationId: session.user.organizationId,
      },
    });

    if (!glCode) {
      return NextResponse.json({ error: "GL code not found" }, { status: 404 });
    }

    const entry = await db.ledgerEntry.create({
      data: {
        organizationId: session.user.organizationId,
        date: parseDateOnly(validatedData.date)!,
        description: validatedData.description,
        reference: validatedData.reference,
        glCodeId: validatedData.glCodeId,
        debit: validatedData.debit,
        credit: validatedData.credit,
        status: validatedData.status,
      },
      include: {
        glCode: true,
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating ledger entry:", error);
    return NextResponse.json({ error: "Failed to create ledger entry" }, { status: 500 });
  }
}

// PATCH /api/ledgers/entries - Update entry status (post/unpost)
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
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (!["POSTED", "PENDING"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const entry = await db.ledgerEntry.update({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      data: { status },
      include: {
        glCode: true,
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Error updating ledger entry:", error);
    return NextResponse.json({ error: "Failed to update ledger entry" }, { status: 500 });
  }
}

// DELETE /api/ledgers/entries - Delete entry (only pending)
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

    const entry = await db.ledgerEntry.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (entry.status === "POSTED") {
      return NextResponse.json(
        { error: "Cannot delete posted entries. Create a reversing entry instead." },
        { status: 400 }
      );
    }

    await db.ledgerEntry.delete({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ledger entry:", error);
    return NextResponse.json({ error: "Failed to delete ledger entry" }, { status: 500 });
  }
}
