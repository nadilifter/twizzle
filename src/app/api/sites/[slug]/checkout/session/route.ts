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
  athleteId?: string;
  athleteName?: string;
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
    const { items, userDetails, contactId, billingAddressId, editingContact, editingAddress, discountCode } = body as { 
      items: CartItem[]; 
      userDetails: any; 
      contactId?: string;
      billingAddressId?: string;
      editingContact?: boolean;
      editingAddress?: boolean;
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

    // 2. Server-side waiver verification (per-athlete)
    // Each athlete in the cart needs waivers signed specifically for them
    const programItems = items.filter((item: CartItem) => item.type === "program");
    if (programItems.length > 0) {
      // Build a map of programId -> required waiver IDs
      const programIds = programItems
        .map((item: CartItem) => item.details?.programId || item.referenceId)
        .filter(Boolean);

      const waiverRequirements = await db.programWaiverRequirement.findMany({
        where: {
          programId: { in: programIds },
          waiver: { organizationId, status: "ACTIVE" },
        },
        select: { waiverId: true, programId: true },
      });

      // Map each program to its required waiver IDs
      const programWaiverMap: Record<string, string[]> = {};
      waiverRequirements.forEach((r) => {
        if (!programWaiverMap[r.programId]) programWaiverMap[r.programId] = [];
        if (!programWaiverMap[r.programId].includes(r.waiverId)) {
          programWaiverMap[r.programId].push(r.waiverId);
        }
      });

      // Find family by email
      const checkFamily = await db.family.findFirst({
        where: { email: userDetails.email, organizationId },
        select: { id: true },
      });

      // Check each athlete's waivers individually
      for (const item of programItems) {
        const pId = item.details?.programId || item.referenceId;
        const athleteId = item.athleteId || item.details?.athleteId;
        const requiredWaiverIds = programWaiverMap[pId] || [];

        if (requiredWaiverIds.length === 0) continue;

        if (!checkFamily) {
          return NextResponse.json(
            { error: `Required waivers have not been signed for athlete ${item.athleteName || athleteId}. Please sign all waivers before proceeding to payment.` },
            { status: 400 }
          );
        }

        // Check acceptances for this specific athlete
        const acceptances = await db.waiverAcceptance.findMany({
          where: {
            familyId: checkFamily.id,
            waiverId: { in: requiredWaiverIds },
            athleteId: athleteId || null,
          },
          select: { waiverId: true },
        });

        const signedIds = new Set(acceptances.map((a) => a.waiverId));
        const unsignedWaivers = requiredWaiverIds.filter((id) => !signedIds.has(id));

        if (unsignedWaivers.length > 0) {
          return NextResponse.json(
            { error: `Required waivers have not been signed for athlete ${item.athleteName || athleteId}. Please sign all waivers before proceeding to payment.` },
            { status: 400 }
          );
        }
      }
    }

    // 2b. Server-side medical info verification
    // Check that all athletes in programs requiring medical info have completed it
    if (programItems.length > 0) {
      const programIds = programItems
        .map((item: CartItem) => item.details?.programId || item.referenceId)
        .filter(Boolean);

      const programsWithMedical = await db.program.findMany({
        where: {
          id: { in: programIds },
          organizationId,
          hasMedicalRequirement: true,
        },
        select: { id: true },
      });

      if (programsWithMedical.length > 0) {
        // Collect unique athlete IDs from program items whose programs require medical
        const medicalProgramIds = new Set(programsWithMedical.map((p) => p.id));
        const athleteIds = [...new Set(
          programItems
            .filter((item: CartItem) => {
              const pid = item.details?.programId || item.referenceId;
              return pid && medicalProgramIds.has(pid);
            })
            .map((item: CartItem) => item.athleteId || item.details?.athleteId)
            .filter(Boolean) as string[]
        )];

        if (athleteIds.length > 0) {
          // Check that each athlete has medical info
          const medicalInfoRecords = await db.athleteMedicalInfo.findMany({
            where: {
              athleteId: { in: athleteIds },
            },
            select: { athleteId: true },
          });

          const athletesWithMedical = new Set(medicalInfoRecords.map((r) => r.athleteId));
          const athletesMissing = athleteIds.filter((id) => !athletesWithMedical.has(id));

          if (athletesMissing.length > 0) {
            return NextResponse.json(
              { error: "Medical information is required for all athletes. Please complete the medical information forms before proceeding to payment." },
              { status: 400 }
            );
          }
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
    // Resolve contact details: use saved contact if contactId provided, else use form data
    let resolvedContact = {
      firstName: userDetails.firstName,
      lastName: userDetails.lastName,
      email: userDetails.email,
      phone: userDetails.phone,
    };

    if (contactId) {
      if (editingContact) {
        // User is editing the saved contact — use form data and update the saved record
        resolvedContact = {
          firstName: userDetails.firstName,
          lastName: userDetails.lastName,
          email: userDetails.email,
          phone: userDetails.phone,
        };
        await db.familyContact.update({
          where: { id: contactId },
          data: {
            firstName: userDetails.firstName,
            lastName: userDetails.lastName,
            email: userDetails.email,
            phone: userDetails.phone,
          },
        });
      } else {
        // Use the saved contact data as-is
        const savedContact = await db.familyContact.findUnique({ where: { id: contactId } });
        if (savedContact) {
          resolvedContact = {
            firstName: savedContact.firstName,
            lastName: savedContact.lastName,
            email: savedContact.email,
            phone: savedContact.phone,
          };
        }
      }
    }

    // Resolve billing address: use saved address if billingAddressId provided, else use form data
    let resolvedAddress = {
      street: userDetails.address || "",
      city: userDetails.city || "",
      stateProvince: userDetails.stateProvince || "",
      postalCode: userDetails.postalCode || "",
    };

    if (billingAddressId) {
      if (editingAddress) {
        // User is editing the saved address — use form data and update the saved record
        resolvedAddress = {
          street: userDetails.address || "",
          city: userDetails.city || "",
          stateProvince: userDetails.stateProvince || "",
          postalCode: userDetails.postalCode || "",
        };
        await db.familyBillingAddress.update({
          where: { id: billingAddressId },
          data: {
            street: userDetails.address || "",
            city: userDetails.city || "",
            stateProvince: userDetails.stateProvince || null,
            postalCode: userDetails.postalCode || "",
          },
        });
      } else {
        // Use the saved address data as-is
        const savedAddress = await db.familyBillingAddress.findUnique({ where: { id: billingAddressId } });
        if (savedAddress) {
          resolvedAddress = {
            street: savedAddress.street,
            city: savedAddress.city,
            stateProvince: savedAddress.stateProvince || "",
            postalCode: savedAddress.postalCode,
          };
        }
      }
    }

    let family = await db.family.findFirst({
        where: {
            organizationId,
            email: resolvedContact.email
        }
    });

    if (!family) {
        family = await db.family.create({
            data: {
                name: `${resolvedContact.lastName} Family`,
                primaryContact: `${resolvedContact.firstName} ${resolvedContact.lastName}`,
                email: resolvedContact.email,
                phone: resolvedContact.phone,
                address: [resolvedAddress.street, resolvedAddress.city, resolvedAddress.stateProvince, resolvedAddress.postalCode].filter(Boolean).join(", "),
                organizationId
            }
        });
    } else {
        // Update the family's flat address field for backward compatibility
        await db.family.update({
            where: { id: family.id },
            data: {
                address: [resolvedAddress.street, resolvedAddress.city, resolvedAddress.stateProvince, resolvedAddress.postalCode].filter(Boolean).join(", "),
                phone: resolvedContact.phone || family.phone,
            },
        });
    }

    // Save new contact to family profile if not using a saved one
    if (!contactId && resolvedContact.firstName && resolvedContact.email) {
      // Check if a contact with this email already exists for this family
      const existingContact = await db.familyContact.findFirst({
        where: { familyId: family.id, email: resolvedContact.email },
      });
      if (!existingContact) {
        const hasAnyContacts = await db.familyContact.count({ where: { familyId: family.id } });
        await db.familyContact.create({
          data: {
            familyId: family.id,
            firstName: resolvedContact.firstName,
            lastName: resolvedContact.lastName,
            email: resolvedContact.email,
            phone: resolvedContact.phone,
            relationship: "Parent",
            isPrimary: hasAnyContacts === 0,
          },
        });
      }
    }

    // Save new billing address to family profile if not using a saved one
    if (!billingAddressId && resolvedAddress.street) {
      // Check if this exact address already exists for this family
      const existingAddress = await db.familyBillingAddress.findFirst({
        where: {
          familyId: family.id,
          street: resolvedAddress.street,
          city: resolvedAddress.city,
          postalCode: resolvedAddress.postalCode,
        },
      });
      if (!existingAddress) {
        const hasAnyAddresses = await db.familyBillingAddress.count({ where: { familyId: family.id } });
        await db.familyBillingAddress.create({
          data: {
            familyId: family.id,
            label: "Home",
            street: resolvedAddress.street,
            city: resolvedAddress.city,
            stateProvince: resolvedAddress.stateProvince || null,
            postalCode: resolvedAddress.postalCode,
            country: "US",
            isPrimary: hasAnyAddresses === 0,
          },
        });
      }
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
        resolvedContact.email
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
