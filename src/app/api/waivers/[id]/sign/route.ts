import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const signWaiverSchema = z.object({
  familyId: z.string().min(1, "Family ID is required"),
  signedByName: z.string().min(1, "Signer name is required"),
  signedByEmail: z.string().email("Valid email is required"),
  signatures: z.array(z.object({
    waiverPageId: z.string().min(1),
    signatureData: z.string().min(1, "Signature data is required"),
  })).min(1, "At least one signature is required"),
});

// POST /api/waivers/[id]/sign - Sign waiver pages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: waiverId } = await params;
    const body = await request.json();
    const validatedData = signWaiverSchema.parse(body);

    // Verify waiver exists and belongs to this organization
    const waiver = await db.waiver.findFirst({
      where: {
        id: waiverId,
        organizationId: session.user.organizationId,
        status: "ACTIVE",
      },
      include: {
        pages: {
          orderBy: { pageNumber: "asc" },
        },
      },
    });

    if (!waiver) {
      return NextResponse.json(
        { error: "Waiver not found or not active" },
        { status: 404 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;

    const result = await db.$transaction(async (tx) => {
      // Create signature records for each page
      for (const sig of validatedData.signatures) {
        await tx.waiverSignature.upsert({
          where: {
            waiverPageId_familyId: {
              waiverPageId: sig.waiverPageId,
              familyId: validatedData.familyId,
            },
          },
          update: {
            signatureData: sig.signatureData,
            signedByName: validatedData.signedByName,
            signedByEmail: validatedData.signedByEmail,
            ipAddress,
            userAgent,
            signedAt: new Date(),
          },
          create: {
            waiverId,
            waiverPageId: sig.waiverPageId,
            familyId: validatedData.familyId,
            signatureData: sig.signatureData,
            signedByName: validatedData.signedByName,
            signedByEmail: validatedData.signedByEmail,
            ipAddress,
            userAgent,
          },
        });
      }

      // Check if ALL pages of this waiver are now signed by this family
      const totalPages = waiver.pages.length;
      const signedPages = await tx.waiverSignature.count({
        where: {
          waiverId,
          familyId: validatedData.familyId,
        },
      });

      if (signedPages >= totalPages) {
        // All pages signed - create or update the acceptance record
        await tx.waiverAcceptance.upsert({
          where: {
            waiverId_familyId: {
              waiverId,
              familyId: validatedData.familyId,
            },
          },
          update: {
            completedAt: new Date(),
          },
          create: {
            waiverId,
            familyId: validatedData.familyId,
          },
        });

        return { allPagesSigned: true };
      }

      return {
        allPagesSigned: false,
        signedCount: signedPages,
        totalPages,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error signing waiver:", error);
    return NextResponse.json(
      { error: "Failed to sign waiver" },
      { status: 500 }
    );
  }
}
