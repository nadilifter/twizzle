import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPaymentSession } from "@/lib/adyen";

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const { items, userDetails, discountCode } = body;
    const subdomain = params.slug;

    // 1. Get Organization
    const config = await db.websiteConfig.findUnique({
      where: { subdomain },
      include: { organization: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const organizationId = config.organizationId;

    // 2. Calculate Totals (Verify prices from DB ideally, but using cart for now for speed)
    // In production, fetch items from DB to verify prices
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + Number(item.price) * item.quantity,
      0
    );
    const taxRate = 0.13;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // 3. Find or Create Family/User
    // Simple logic: match by email on Family.primaryContactEmail or User.email
    // For this demo, we'll create a Family if it doesn't exist
    let family = await db.family.findFirst({
        where: {
            organizationId,
            email: userDetails.email
        }
    });

    if (!family) {
        family = await db.family.create({
            data: {
                name: `${userDetails.lastName} Family`,
                primaryContact: `${userDetails.firstName} ${userDetails.lastName}`,
                email: userDetails.email,
                phone: userDetails.phone,
                address: userDetails.address, // combining address fields would be better
                organizationId
            }
        });
    }

    // 4. Create Invoice
    const invoice = await db.invoice.create({
        data: {
            reference: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            familyId: family.id,
            organizationId,
            subtotal,
            tax,
            total,
            status: "DRAFT",
            dueDate: new Date(), // Due immediately
        }
    });

    // 5. Create Line Items
    await db.lineItem.createMany({
        data: items.map((item: any) => ({
            invoiceId: invoice.id,
            description: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            total: Number(item.price) * item.quantity,
            programId: item.type === 'program' ? item.details?.programId : undefined,
            // discountId if applicable
        }))
    });

    // 6. Create Adyen Session
    // We'll use the invoice ID as reference so we can update it later
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const returnUrl = `${protocol}://${host}/sites/${subdomain}/receipt/${invoice.id}`;

    const session = await createPaymentSession(
        total,
        "USD",
        invoice.id, // Using invoice ID as reference for webhook matching
        returnUrl,
        userDetails.email
    );

    return NextResponse.json({
        sessionId: session.id,
        sessionData: session.sessionData,
        invoiceId: invoice.id
    });

  } catch (error) {
    console.error("Checkout Session Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
