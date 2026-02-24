import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const signWaiverSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
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

    const ipAddress = request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const userId = validatedData.userId;

    const result = await db.$transaction(async (tx) => {
      for (const sig of validatedData.signatures) {
        const existing = await tx.waiverSignature.findFirst({
          where: {
            waiverPageId: sig.waiverPageId,
            userId,
            athleteId: null,
          },
        });

        if (existing) {
          await tx.waiverSignature.update({
            where: { id: existing.id },
            data: {
              signatureData: sig.signatureData,
              signedByName: validatedData.signedByName,
              signedByEmail: validatedData.signedByEmail,
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
              athleteId: null,
              signatureData: sig.signatureData,
              signedByName: validatedData.signedByName,
              signedByEmail: validatedData.signedByEmail,
              ipAddress,
              userAgent,
            },
          });
        }
      }

      // Check if ALL pages of this waiver are now signed
      const totalPages = waiver.pages.length;
      const signedPages = await tx.waiverSignature.count({
        where: { waiverId, userId },
      });

      if (signedPages >= totalPages) {
        const existingAcceptance = await tx.waiverAcceptance.findFirst({
          where: { waiverId, userId, athleteId: null },
        });

        if (existingAcceptance) {
          await tx.waiverAcceptance.update({
            where: { id: existingAcceptance.id },
            data: { completedAt: new Date() },
          });
        } else {
          await tx.waiverAcceptance.create({
            data: { waiverId, userId },
          });
        }

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
