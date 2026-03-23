import { db } from "@/lib/db";

/**
 * Promotes the next waitlisted enrollment to ACTIVE for a program.
 * Uses a transaction to prevent double-promotion when concurrent
 * cancellations open spots simultaneously.
 */
export async function promoteFromWaitlist(programId: string): Promise<{ promoted: boolean; athleteId?: string }> {
  return db.$transaction(async (tx) => {
    const program = await tx.program.findUnique({
      where: { id: programId },
      select: {
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

    return { promoted: true, athleteId: nextWaitlisted.athleteId };
  });
}

/**
 * Promotes the next waitlisted instance registration to REGISTERED.
 * Uses a transaction to prevent double-promotion under concurrent cancellations.
 */
export async function promoteFromInstanceWaitlist(instanceId: string): Promise<{ promoted: boolean; athleteId?: string }> {
  return db.$transaction(async (tx) => {
    const instance = await tx.programInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
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
