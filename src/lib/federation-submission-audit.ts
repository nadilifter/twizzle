import { FederationSubmissionEventType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function logFederationSubmissionEvent(params: {
  submissionId: string;
  eventType: FederationSubmissionEventType;
  data?: unknown;
  note?: string | null;
  actorId: string | null;
  prismaClient?: Prisma.TransactionClient;
}): Promise<void> {
  const { submissionId, eventType, data, note, actorId, prismaClient } = params;
  const client = prismaClient ?? db;

  await client.federationSubmissionEvent.create({
    data: {
      submissionId,
      eventType,
      data: data !== undefined ? (data as Prisma.InputJsonValue) : undefined,
      note: note ?? undefined,
      actorId: actorId ?? undefined,
    },
  });
}
