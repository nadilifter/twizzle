import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const publicSignWaiverSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1, "User ID is required"),
  athleteId: z.string().nullish(),
  email: z.string().email(),
  name: z.string().min(1, "Signer name is required"),
  signatures: z.array(z.object({
    waiverPageId: z.string().min(1),
    signatureData: z.string().min(1, "Signature data is required"),
  })).min(1, "At least one signature is required"),
});

// POST /api/public/waivers/[id]/sign
// Public endpoint - sign waiver pages during checkout
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: waiverId } = await params;
    const body = await request.json();
    const validatedData = publicSignWaiverSchema.parse(body);

    // Verify waiver exists, is active, and belongs to the org
    const waiver = await db.waiver.findFirst({
      where: {
        id: waiverId,
        organizationId: validatedData.organizationId,
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

    const userId = validatedData.userId;
    const ipAddress = request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const athleteId = validatedData.athleteId || null;

    const result = await db.$transaction(async (tx) => {
      for (const sig of validatedData.signatures) {
        const existing = await tx.waiverSignature.findFirst({
          where: {
            waiverPageId: sig.waiverPageId,
            userId,
            athleteId,
          },
        });

        if (existing) {
          await tx.waiverSignature.update({
            where: { id: existing.id },
            data: {
              signatureData: sig.signatureData,
              signedByName: validatedData.name,
              signedByEmail: validatedData.email,
              ipAddress,
              userAgent,
              signedAt: new Date(),
            },
          });
        } else {
          await tx.waiverSignature.create({
            data: {
              waiverId,
              waiverPageId: sig.waiverPageId,
              userId,
              athleteId,
              signatureData: sig.signatureData,
              signedByName: validatedData.name,
              signedByEmail: validatedData.email,
              ipAddress,
              userAgent,
            },
          });
        }
      }

      // Check if ALL pages signed for this athlete
      const totalPages = waiver.pages.length;
      const signedPages = await tx.waiverSignature.count({
        where: {
          waiverId,
          userId,
          athleteId,
        },
      });

      if (signedPages >= totalPages) {
        const existingAcceptance = await tx.waiverAcceptance.findFirst({
          where: { waiverId, userId, athleteId },
        });

        if (existingAcceptance) {
          await tx.waiverAcceptance.update({
            where: { id: existingAcceptance.id },
            data: { completedAt: new Date() },
          });
        } else {
          await tx.waiverAcceptance.create({
            data: { waiverId, userId, athleteId },
          });
        }

        return { allPagesSigned: true, userId };
      }

      return {
        allPagesSigned: false,
        userId,
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
    console.error("Error signing waiver (public):", error);
    return NextResponse.json(
      { error: "Failed to sign waiver" },
      { status: 500 }
    );
  }
}
