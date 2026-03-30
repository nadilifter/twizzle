import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { resolvePublicRequest } from "@/lib/public-api";
import { getAuthSession } from "@/lib/auth";

const publicSignWaiverSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1, "User ID is required"),
  athleteId: z.string().nullish(),
  email: z.string().email(),
  name: z.string().min(1, "Signer name is required"),
  signatures: z
    .array(
      z.object({
        waiverPageId: z.string().min(1),
        signatureData: z.string().min(1, "Signature data is required"),
      })
    )
    .min(1, "At least one signature is required"),
});

// POST /api/public/waivers/[id]/sign
// Requires authentication — signing legal waivers must have a verified session
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id: waiverId } = await params;
    const body = await request.json();
    const validatedData = publicSignWaiverSchema.parse(body);

    const orgResult = await resolvePublicRequest(request, validatedData.organizationId);
    if (orgResult instanceof NextResponse) return orgResult;
    const { organizationId } = orgResult;

    const waiver = await db.waiver.findFirst({
      where: {
        id: waiverId,
        organizationId,
        status: "ACTIVE",
      },
      include: {
        pages: {
          orderBy: { pageNumber: "asc" },
        },
      },
    });

    if (!waiver) {
      return NextResponse.json({ error: "Waiver not found or not active" }, { status: 404 });
    }

    // Use session user ID instead of client-provided userId to prevent
    // signing waivers on behalf of other users
    const userId = session.user.id;
    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const athleteId = validatedData.athleteId || null;

    const validPageIds = new Set(waiver.pages.map((p) => p.id));
    for (const sig of validatedData.signatures) {
      if (!validPageIds.has(sig.waiverPageId)) {
        return NextResponse.json({ error: "Invalid waiver page" }, { status: 400 });
      }
    }

    const result = await db.$transaction(async (tx) => {
      for (const sig of validatedData.signatures) {
        const existing = await tx.waiverSignature.findFirst({
          where: {
            waiverPageId: sig.waiverPageId,
            userId,
            athleteId,
          },
        });

        const signerEmail = session.user.email || validatedData.email;
        const signerName = validatedData.name;

        if (existing) {
          await tx.waiverSignature.update({
            where: { id: existing.id },
            data: {
              signatureData: sig.signatureData,
              signedByName: signerName,
              signedByEmail: signerEmail,
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
              signedByName: signerName,
              signedByEmail: signerEmail,
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
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error signing waiver (public):", error);
    return NextResponse.json({ error: "Failed to sign waiver" }, { status: 500 });
  }
}
