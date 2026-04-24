/**
 * POST /api/sites/[slug]/programs/[id]/waitlist
 *
 * Adds the authenticated user's athlete to the program waitlist directly,
 * bypassing the checkout flow. Validates the program is actually full server-side
 * (prevents API bypass), requires a payment method on file for paid programs,
 * and uses a row lock to prevent race conditions with promoteFromWaitlist.
 *
 * When a spot opens (enrollment cancelled), promoteFromWaitlist in
 * src/lib/waitlist-promotion.ts handles charging and notifying the next person.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  athleteId: z.string().min(1),
  instanceIds: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug, id: programId } = await params;

    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });
    if (!config) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const program = await db.program.findUnique({
      where: { id: programId, organizationId: config.organizationId },
      select: {
        id: true,
        organizationId: true,
        registrationType: true,
        hasCapacityRestriction: true,
        capacity: true,
        waitlistEnabled: true,
        waitlistCapacity: true,
        basePrice: true,
        perSessionPrice: true,
        pricingModel: true,
      },
    });
    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    if (!program.waitlistEnabled) {
      return NextResponse.json(
        { error: "Waitlist is not enabled for this program" },
        { status: 400 }
      );
    }

    // Paid programs require a payment method on file
    const programPrice =
      program.pricingModel === "PER_SESSION"
        ? Number(program.perSessionPrice ?? 0)
        : Number(program.basePrice ?? 0);
    if (programPrice > 0) {
      const pmCount = await db.paymentMethod.count({ where: { userId: session.user.id } });
      if (pmCount === 0) {
        return NextResponse.json(
          { error: "A payment method is required to join the waitlist" },
          { status: 400 }
        );
      }
    }

    const body = await request.json();
    const { athleteId, instanceIds } = bodySchema.parse(body);

    // Verify the athlete belongs to this user
    const athleteLink = await db.athleteGuardian.findFirst({
      where: { athleteId, userId: session.user.id },
    });
    if (!athleteLink) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Guard against duplicate enrollment
    const existing = await db.enrollment.findFirst({
      where: {
        programId,
        athleteId,
        status: { in: ["ACTIVE", "WAITLISTED", "WAITLIST_PAYMENT_PENDING"] },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Athlete is already enrolled or waitlisted for this program" },
        { status: 409 }
      );
    }

    // Use a row lock to serialize concurrent joins and prevent races with promoteFromWaitlist
    const { enrollment, queuePosition } = await db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Program" WHERE id = ${programId} FOR UPDATE`);

      // Re-verify inside the lock: if a spot opened up, don't add to waitlist.
      // ACTIVE + WAITLIST_PAYMENT_PENDING both count as occupying a spot.
      if (program.hasCapacityRestriction && program.capacity != null) {
        const occupiedCount = await tx.enrollment.count({
          where: { programId, status: { in: ["ACTIVE", "WAITLIST_PAYMENT_PENDING"] } },
        });
        if (occupiedCount < program.capacity) {
          throw new Error("SPOT_AVAILABLE");
        }
      }

      // Re-verify waitlist capacity inside the lock
      const currentWaitlisted = await tx.enrollment.count({
        where: { programId, status: "WAITLISTED" },
      });
      if (program.waitlistCapacity != null && currentWaitlisted >= program.waitlistCapacity) {
        throw new Error("WAITLIST_FULL");
      }

      const newEnrollment = await tx.enrollment.upsert({
        where: { programId_athleteId: { programId, athleteId } },
        update: {
          status: "WAITLISTED",
          userId: session.user.id,
          startDate: new Date(),
          waitlistPaymentDeadline: null,
          waitlistChargeAttempts: 0,
        },
        create: {
          programId,
          athleteId,
          userId: session.user.id,
          status: "WAITLISTED",
          startDate: new Date(),
        },
      });

      if (program.registrationType === "PER_INSTANCE" && instanceIds?.length) {
        for (const instanceId of instanceIds) {
          await tx.instanceRegistration.upsert({
            where: { programInstanceId_athleteId: { programInstanceId: instanceId, athleteId } },
            update: { status: "WAITLISTED" },
            create: {
              programInstanceId: instanceId,
              athleteId,
              userId: session.user.id,
              status: "WAITLISTED",
            },
          });
        }
      }

      return { enrollment: newEnrollment, queuePosition: currentWaitlisted + 1 };
    });

    return NextResponse.json({ success: true, enrollmentId: enrollment.id, queuePosition });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SPOT_AVAILABLE") {
      return NextResponse.json(
        { error: "A spot just opened up — please register normally" },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "WAITLIST_FULL") {
      return NextResponse.json({ error: "Waitlist is full" }, { status: 400 });
    }
    console.error("Error joining waitlist:", error);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }
}
