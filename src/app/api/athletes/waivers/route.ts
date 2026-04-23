import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/athletes/waivers?athleteId=xxx
 *
 * Returns waiver acceptances for a specific athlete, grouped by organization.
 * Each waiver includes its pages (HTML content) and per-page signature data so
 * guardians can view the signed document + applied signature.
 * Only returns data if the current user is a guardian of the athlete.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId =
      session.user.isSuperAdmin && session.user.viewingAsUserId
        ? session.user.viewingAsUserId
        : session.user.id;

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");

    if (!athleteId) {
      return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
    }

    // Verify guardian access
    const guardianLink = await db.athleteGuardian.findFirst({
      where: { athleteId, userId },
    });

    if (!guardianLink) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const acceptances = await db.waiverAcceptance.findMany({
      where: { athleteId },
      include: {
        waiver: {
          select: {
            id: true,
            title: true,
            organizationId: true,
            organization: {
              select: { id: true, name: true },
            },
            pages: {
              orderBy: { pageNumber: "asc" },
              select: { id: true, pageNumber: true, title: true, content: true },
            },
          },
        },
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { completedAt: "desc" },
    });

    const signatures =
      acceptances.length > 0
        ? await db.waiverSignature.findMany({
            where: {
              athleteId,
              waiverId: { in: acceptances.map((a) => a.waiverId) },
            },
            select: {
              waiverPageId: true,
              signatureData: true,
              signedByName: true,
              signedByEmail: true,
              signedAt: true,
            },
          })
        : [];

    const signaturesByPage = new Map(signatures.map((s) => [s.waiverPageId, s]));

    const data = acceptances.map((a) => ({
      id: a.id,
      completedAt: a.completedAt.toISOString(),
      waiver: {
        id: a.waiver.id,
        title: a.waiver.title,
        organizationId: a.waiver.organizationId,
        organization: a.waiver.organization,
        pages: a.waiver.pages.map((p) => {
          const sig = signaturesByPage.get(p.id);
          return {
            id: p.id,
            pageNumber: p.pageNumber,
            title: p.title,
            content: p.content,
            signature: sig
              ? {
                  signatureData: sig.signatureData,
                  signedByName: sig.signedByName,
                  signedByEmail: sig.signedByEmail,
                  signedAt: sig.signedAt.toISOString(),
                }
              : null,
          };
        }),
      },
      user: a.user,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching athlete waivers:", error);
    return NextResponse.json({ error: "Failed to fetch waivers" }, { status: 500 });
  }
}
