import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPaymentSession } from "@/lib/adyen";

interface CartItem {
  referenceId: string;
  type: "program" | "membership" | "item" | "event";
  name: string;
  description?: string;
  price: number;
  quantity: number;
  details?: {
    programId?: string;
    membershipInstanceId?: string;
    athleteId?: string;
    level?: string;
    interval?: string;
    requiredMemberships?: string[];
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const { items, userDetails, discountCode } = body as { 
      items: CartItem[]; 
      userDetails: any; 
      discountCode?: string 
    };
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

    // 2. Server-side waiver verification
    // Check that all required waivers for cart programs are signed
    const programItems = items.filter((item: CartItem) => item.type === "program");
    if (programItems.length > 0) {
      const programIds = programItems
        .map((item: CartItem) => item.details?.programId || item.referenceId)
        .filter(Boolean);

      const waiverRequirements = await db.programWaiverRequirement.findMany({
        where: {
          programId: { in: programIds },
          waiver: { organizationId, status: "ACTIVE" },
        },
        select: { waiverId: true },
      });

      const requiredWaiverIds = [...new Set(waiverRequirements.map((r) => r.waiverId))];

      if (requiredWaiverIds.length > 0) {
        // Find or check family by email
        const checkFamily = await db.family.findFirst({
          where: { email: userDetails.email, organizationId },
          select: { id: true },
        });

        if (checkFamily) {
          const acceptances = await db.waiverAcceptance.findMany({
            where: {
              familyId: checkFamily.id,
              waiverId: { in: requiredWaiverIds },
            },
            select: { waiverId: true },
          });

          const signedIds = new Set(acceptances.map((a) => a.waiverId));
          const unsignedWaivers = requiredWaiverIds.filter((id) => !signedIds.has(id));

          if (unsignedWaivers.length > 0) {
            return NextResponse.json(
              { error: "Required waivers have not been signed. Please sign all waivers before proceeding to payment." },
              { status: 400 }
            );
          }
        } else {
          // No family exists yet, so waivers definitely haven't been signed
          return NextResponse.json(
            { error: "Required waivers have not been signed. Please sign all waivers before proceeding to payment." },
            { status: 400 }
          );
        }
      }
    }

    // 3. Calculate Totals (Verify prices from DB ideally, but using cart for now for speed)
    // In production, fetch items from DB to verify prices
    const subtotal = items.reduce(
      (sum: number, item: CartItem) => sum + Number(item.price) * item.quantity,
      0
    );
    const taxRate = 0.13;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // 4. Find or Create Family/User
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

    // 5. Create Invoice with metadata for post-payment processing
    const membershipItems = items.filter((item: CartItem) => item.type === "membership");
    
    // Build metadata for webhook processing
    const invoiceMetadata = {
      membershipPurchases: membershipItems.map(item => ({
        membershipInstanceId: item.details?.membershipInstanceId || item.referenceId,
        athleteId: item.details?.athleteId,
        quantity: item.quantity,
      })),
      programRegistrations: programItems.map(item => ({
        programId: item.details?.programId,
        requiredMemberships: item.details?.requiredMemberships || [],
      })),
    };
    
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
            notes: JSON.stringify(invoiceMetadata), // Store metadata for webhook processing
        }
    });

    // 6. Create Line Items with appropriate metadata
    await db.lineItem.createMany({
        data: items.map((item: CartItem) => ({
            invoiceId: invoice.id,
            description: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            total: Number(item.price) * item.quantity,
            programId: item.type === 'program' ? item.details?.programId : undefined,
            // Note: For membership items, we store the membershipInstanceId in the description
            // or a separate field could be added to LineItem model
        }))
    });

    // 7. Create Adyen Session
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
        invoiceId: invoice.id,
        // Return info about required memberships for frontend validation
        hasMembershipPurchases: membershipItems.length > 0,
        hasProgramRegistrations: programItems.length > 0,
    });

  } catch (error) {
    console.error("Checkout Session Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
