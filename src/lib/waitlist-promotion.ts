import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { executeNotificationByTrigger } from "@/lib/notification-service";

/**
 * Promotes the next waitlisted enrollment to ACTIVE for a program.
 * Locks the Program row to serialize concurrent promotions and prevent
 * over-admitting beyond capacity.
 */
export async function promoteFromWaitlist(
  programId: string
): Promise<{ promoted: boolean; athleteId?: string }> {
  interface TxResult {
    promoted: boolean;
    athleteId?: string;
    notifyCtx?: { organizationId: string; athleteId: string; programName: string; userId?: string };
  }

  const txResult: TxResult = await db.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Program" WHERE id = ${programId} FOR UPDATE`);

    const program = await tx.program.findUnique({
      where: { id: programId },
      select: {
        name: true,
        organizationId: true,
        waitlistEnabled: true,
        waitlistAutoPromote: true,
        capacity: true,
        hasCapacityRestriction: true,
      },
    });

    if (!program?.waitlistEnabled || !program.waitlistAutoPromote) {
      return { promoted: false };
    }

    if (program.hasCapacityRestriction && program.capacity != null) {
      const activeCount = await tx.enrollment.count({
        where: { programId, status: "ACTIVE" },
      });
      if (activeCount >= program.capacity) {
        return { promoted: false };
      }
    }

    const nextWaitlisted = await tx.enrollment.findFirst({
      where: { programId, status: "WAITLISTED" },
      orderBy: { createdAt: "asc" },
    });

    if (!nextWaitlisted) {
      return { promoted: false };
    }

    await tx.enrollment.update({
      where: { id: nextWaitlisted.id },
      data: { status: "ACTIVE" },
    });

    const instances = await tx.programInstance.findMany({
      where: { programId, status: { not: "CANCELLED" } },
      select: { id: true },
    });

    for (const inst of instances) {
      await tx.instanceRegistration.upsert({
        where: {
          programInstanceId_athleteId: {
            programInstanceId: inst.id,
            athleteId: nextWaitlisted.athleteId,
          },
        },
        update: { status: "REGISTERED" },
        create: {
          programInstanceId: inst.id,
          athleteId: nextWaitlisted.athleteId,
          userId: nextWaitlisted.userId || undefined,
          status: "REGISTERED",
        },
      });
    }

    return {
      promoted: true,
      athleteId: nextWaitlisted.athleteId,
      notifyCtx: {
        organizationId: program.organizationId,
        athleteId: nextWaitlisted.athleteId,
        programName: program.name,
        userId: nextWaitlisted.userId ?? undefined,
      },
    };
  });

  if (txResult.notifyCtx) {
    try {
      await executeNotificationByTrigger({
        organizationId: txResult.notifyCtx.organizationId,
        triggerType: "WAITLIST_OPENING",
        userId: txResult.notifyCtx.userId,
        athleteId: txResult.notifyCtx.athleteId,
        context: {
          programName: txResult.notifyCtx.programName,
        },
      });
    } catch (err) {
      console.error("Failed to send waitlist promotion notification", err);
    }
  }

  return { promoted: txResult.promoted, athleteId: txResult.athleteId };
}

/**
 * Promotes the next waitlisted instance registration to REGISTERED.
 * Locks the ProgramInstance row to serialize concurrent promotions
 * and prevent exceeding instance capacity.
 */
export async function promoteFromInstanceWaitlist(
  instanceId: string
): Promise<{ promoted: boolean; athleteId?: string }> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "ProgramInstance" WHERE id = ${instanceId} FOR UPDATE`
    );

    const instance = await tx.programInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        capacity: true,
        programId: true,
        program: {
          select: {
            waitlistEnabled: true,
            waitlistAutoPromote: true,
          },
        },
      },
    });

    if (!instance?.program?.waitlistEnabled || !instance.program.waitlistAutoPromote) {
      return { promoted: false };
    }

    if (instance.capacity != null) {
      const registeredCount = await tx.instanceRegistration.count({
        where: { programInstanceId: instanceId, status: "REGISTERED" },
      });
      if (registeredCount >= instance.capacity) {
        return { promoted: false };
      }
    }

    const nextWaitlisted = await tx.instanceRegistration.findFirst({
      where: { programInstanceId: instanceId, status: "WAITLISTED" },
      orderBy: { createdAt: "asc" },
    });

    if (!nextWaitlisted) {
      return { promoted: false };
    }

    await tx.instanceRegistration.update({
      where: { id: nextWaitlisted.id },
      data: { status: "REGISTERED" },
    });

    return { promoted: true, athleteId: nextWaitlisted.athleteId };
  });
}
