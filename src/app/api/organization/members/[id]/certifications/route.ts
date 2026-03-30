import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id } = await params;

    const member = await db.organizationMember.findFirst({
      where: { id, organizationId },
    });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const memberCertifications = await db.memberCertification.findMany({
      where: { memberId: id },
      include: {
        certification: true,
        grantedBy: {
          select: {
            id: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { grantedAt: "desc" },
    });

    const allCertifications = await db.certification.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    });

    const certStatus = allCertifications.map((cert) => {
      const memberCert = memberCertifications.find((mc) => mc.certificationId === cert.id);
      const now = new Date();
      let status: "active" | "expired" | "failed" | "not_granted" = "not_granted";

      if (memberCert) {
        if (!memberCert.passed) {
          status = "failed";
        } else if (memberCert.expiresAt && new Date(memberCert.expiresAt) < now) {
          status = "expired";
        } else {
          status = "active";
        }
      }

      return {
        certification: cert,
        memberCertification: memberCert ?? null,
        status,
      };
    });

    return NextResponse.json(certStatus);
  } catch (error) {
    console.error("Error fetching member certifications:", error);
    return NextResponse.json({ error: "Failed to fetch member certifications" }, { status: 500 });
  }
}
