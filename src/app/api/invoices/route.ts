import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  programId: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
  athleteId: z.string().optional().nullable(),
  discountId: z.string().optional().nullable(),
});

const createInvoiceSchema = z.object({
  userId: z.string().min(1, "Guardian is required"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED", "PARTIAL"]).default("DRAFT"),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

// Generate unique invoice reference
async function generateReference(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.invoice.count({
    where: {
      organizationId,
      createdAt: {
        gte: new Date(year, 0, 1),
      },
    },
  });
  return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
}

// GET /api/invoices
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const programId = searchParams.get("programId");
    const athleteId = searchParams.get("athleteId");
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
        { reference: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // Filter by program or athlete through line items
    if (programId || athleteId) {
      where.lineItems = {
        some: {
          ...(programId && { programId }),
          ...(athleteId && { athleteId }),
        },
      };
    }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lineItems: {
            include: {
              program: {
                select: { id: true, name: true },
              },
              event: {
                select: { id: true, title: true },
              },
              athlete: {
                select: { id: true, name: true },
              },
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              processedAt: true,
            },
          },
          _count: {
            select: {
              payments: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.invoice.count({ where }),
    ]);

    // Calculate paid amounts
    const transformedInvoices = invoices.map((invoice) => {
      const paidAmount = invoice.payments
        .filter((p) => p.status === "COMPLETED")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        ...invoice,
        paidAmount,
        balanceDue: Number(invoice.total) - paidAmount,
      };
    });

    // Fetch site subdomain for receipt URL construction
    const siteConfig = await db.websiteConfig.findFirst({
      where: { organizationId: session.user.organizationId },
      select: { subdomain: true },
    });

    return NextResponse.json({
      data: transformedInvoices,
      total,
      limit,
      offset,
      siteSubdomain: siteConfig?.subdomain || null,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

// POST /api/invoices
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
    const validatedData = createInvoiceSchema.parse(body);

    // Verify guardian user exists
    const guardianUser = await db.user.findUnique({
      where: { id: validatedData.userId },
      select: { id: true },
    });
    if (!guardianUser) {
      return NextResponse.json({ error: "Guardian not found" }, { status: 404 });
    }

    // Generate reference
    const reference = await generateReference(session.user.organizationId);

    // Calculate totals
    const lineItemsWithTotals = validatedData.lineItems.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
    }));

    const subtotal = lineItemsWithTotals.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal; // Add tax calculation if needed

    const invoice = await db.invoice.create({
      data: {
        reference,
        userId: validatedData.userId,
        status: validatedData.status,
        dueDate: new Date(validatedData.dueDate),
        subtotal,
        total,
        notes: validatedData.notes,
        organizationId: session.user.organizationId,
        lineItems: {
          create: lineItemsWithTotals.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            programId: item.programId,
            eventId: item.eventId,
            athleteId: item.athleteId,
            discountId: item.discountId,
          })),
        },
      },
      include: {
        lineItems: {
          include: {
            program: true,
            event: true,
            athlete: true,
          },
        },
      },
    });

    if (validatedData.status === "SENT") {
      await db.user.update({
        where: { id: validatedData.userId },
        data: { balance: { increment: total } },
      });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
