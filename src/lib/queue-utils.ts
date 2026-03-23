import { Prisma, PrismaClient } from "@prisma/client";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Admits the next waiting user in a registration queue.
 * Must be called inside a transaction to prevent race conditions.
 *
 * Returns true if a user was admitted, false otherwise.
 */
export async function admitNextInQueue(
  tx: TransactionClient,
  queueConfigId: string
): Promise<boolean> {
  const config = await tx.registrationQueueConfig.findUnique({
    where: { id: queueConfigId },
  });

  if (!config) return false;

  const activeCount = await tx.queueReservation.count({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      queueEntry: {
        queueConfigId,
      },
    },
  });

  if (activeCount >= config.maxConcurrent) return false;

  const nextEntry = await tx.queueEntry.findFirst({
    where: {
      queueConfigId,
      status: "WAITING",
    },
    orderBy: { enteredAt: "asc" },
  });

  if (!nextEntry) return false;

  await tx.queueEntry.update({
    where: { id: nextEntry.id },
    data: {
      status: "ADMITTED",
      admittedAt: new Date(),
    },
  });

  await tx.queueReservation.create({
    data: {
      queueEntryId: nextEntry.id,
      programId: config.programId || "",
      expiresAt: new Date(
        Date.now() + config.reservationMinutes * 60 * 1000
      ),
    },
  });

  await tx.queueEntry.updateMany({
    where: {
      queueConfigId,
      status: "WAITING",
      enteredAt: { gt: nextEntry.enteredAt },
    },
    data: {
      position: { decrement: 1 },
    },
  });

  return true;
}

/**
 * Acquires a row-level lock on a RegistrationQueueConfig row.
 * Use inside a transaction to serialize concurrent admission attempts
 * and prevent exceeding maxConcurrent.
 */
export async function lockQueueConfig(
  tx: TransactionClient,
  queueConfigId: string
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "RegistrationQueueConfig" WHERE id = ${queueConfigId} FOR UPDATE`
  );
}
