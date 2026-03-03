import { db } from "@/lib/db";

/**
 * Promotes the next waitlisted enrollment to ACTIVE for a program.
 * Called when an active enrollment is cancelled and the program has
 * waitlistAutoPromote enabled. The oldest waitlisted enrollment
 * (by createdAt) is promoted and instance registrations are created
 * for all non-cancelled program instances.
 */
export async function promoteFromWaitlist(programId: string): Promise<{ promoted: boolean; athleteId?: string }> {
  const program = await db.program.findUnique({
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

  // Check if there is actually room now
  if (program.hasCapacityRestriction && program.capacity != null) {
    const activeCount = await db.enrollment.count({
      where: { programId, status: "ACTIVE" },
    });
    if (activeCount >= program.capacity) {
      return { promoted: false };
    }
  }

  const nextWaitlisted = await db.enrollment.findFirst({
    where: { programId, status: "WAITLISTED" },
    orderBy: { createdAt: "asc" },
  });

  if (!nextWaitlisted) {
    return { promoted: false };
  }

  await db.enrollment.update({
    where: { id: nextWaitlisted.id },
    data: { status: "ACTIVE" },
  });

  // Create instance registrations for all non-cancelled instances
  const instances = await db.programInstance.findMany({
    where: { programId, status: { not: "CANCELLED" } },
    select: { id: true },
  });

  for (const inst of instances) {
    await db.instanceRegistration.upsert({
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
}

/**
 * Promotes the next waitlisted instance registration to REGISTERED.
 * Called when a registered instance registration is cancelled and the
 * parent program has waitlistAutoPromote enabled.
 */
export async function promoteFromInstanceWaitlist(instanceId: string): Promise<{ promoted: boolean; athleteId?: string }> {
  const instance = await db.programInstance.findUnique({
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

  const nextWaitlisted = await db.instanceRegistration.findFirst({
    where: { programInstanceId: instanceId, status: "WAITLISTED" },
    orderBy: { createdAt: "asc" },
  });

  if (!nextWaitlisted) {
    return { promoted: false };
  }

  await db.instanceRegistration.update({
    where: { id: nextWaitlisted.id },
    data: { status: "REGISTERED" },
  });

  return { promoted: true, athleteId: nextWaitlisted.athleteId };
}
