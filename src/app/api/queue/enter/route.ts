import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { admitNextInQueue, lockQueueConfig } from "@/lib/queue-utils";
import { getRegistrationStatus } from "@/lib/registration-utils";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      programId,
      competitionId,
      organizationSlug,
      sessionToken: existingToken,
      earlyAccessCode,
    } = body;

    if (!organizationSlug) {
      return NextResponse.json({ error: "Organization slug is required" }, { status: 400 });
    }

    const organization = await db.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Check registration window if a specific program is targeted
    if (programId) {
      const program = await db.program.findFirst({
        where: { id: programId, organizationId: organization.id },
        select: {
          name: true,
          registrationOpen: true,
          registrationStartDate: true,
          registrationStartTime: true,
          registrationEndDate: true,
          registrationEndTime: true,
          earlyAccessCode: true,
        },
      });

      if (program) {
        const status = getRegistrationStatus(program);
        if (status !== "open") {
          const hasValidCode =
            earlyAccessCode &&
            program.earlyAccessCode &&
            earlyAccessCode === program.earlyAccessCode;
          if (!hasValidCode) {
            const reason =
              status === "closed" ? "Registration has closed" : "Registration is not yet open";
            return NextResponse.json(
              { error: `${reason} for "${program.name}".` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Check registration window if a specific competition is targeted
    if (competitionId) {
      const competition = await db.competition.findFirst({
        where: { id: competitionId, organizationId: organization.id },
        select: {
          name: true,
          registrationOpen: true,
          registrationStartDate: true,
          registrationStartTime: true,
          registrationEndDate: true,
          registrationEndTime: true,
          earlyAccessCode: true,
        },
      });

      if (competition) {
        const status = getRegistrationStatus(competition);
        if (status !== "open") {
          const hasValidCode =
            earlyAccessCode &&
            competition.earlyAccessCode &&
            earlyAccessCode === competition.earlyAccessCode;
          if (!hasValidCode) {
            const reason =
              status === "closed" ? "Registration has closed" : "Registration is not yet open";
            return NextResponse.json(
              { error: `${reason} for "${competition.name}".` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Find the queue config (program-specific first, then global fallback).
    // Note: RegistrationQueueConfig.programId references the Program model,
    // so competition-specific configs aren't supported yet — competitions
    // use the org-wide fallback config only.
    let queueConfig = programId
      ? await db.registrationQueueConfig.findFirst({
          where: {
            organizationId: organization.id,
            programId,
            isEnabled: true,
          },
        })
      : null;

    if (!queueConfig) {
      queueConfig = await db.registrationQueueConfig.findFirst({
        where: {
          organizationId: organization.id,
          programId: null,
          isEnabled: true,
        },
      });
    }

    if (!queueConfig) {
      return NextResponse.json({
        queued: false,
        canProceed: true,
        message: "No queue active, proceed to registration",
      });
    }

    if (!checkQueueActive(queueConfig)) {
      return NextResponse.json({
        queued: false,
        canProceed: true,
        message: "Queue is not currently active",
      });
    }

    // Check for an existing session
    if (existingToken) {
      const existingEntry = await db.queueEntry.findUnique({
        where: { sessionToken: existingToken },
        include: { reservation: true },
      });

      if (existingEntry) {
        if (existingEntry.status === "ADMITTED" && existingEntry.reservation) {
          if (new Date(existingEntry.reservation.expiresAt) > new Date()) {
            return NextResponse.json({
              queued: false,
              canProceed: true,
              entry: existingEntry,
              reservation: existingEntry.reservation,
              message: "You have an active reservation",
            });
          }
        }

        if (existingEntry.status === "WAITING") {
          const position = await getQueuePosition(existingEntry);
          const estimatedWait = calculateEstimatedWait(position, queueConfig);

          return NextResponse.json({
            queued: true,
            canProceed: false,
            entry: { ...existingEntry, position },
            position,
            estimatedWaitMinutes: estimatedWait,
            message: `You are #${position} in line`,
          });
        }
      }
    }

    const sessionToken = existingToken || uuidv4();

    // Use a serialized transaction with a row-level lock on the queue config
    // to prevent concurrent requests from exceeding maxConcurrent.
    const result = await db.$transaction(async (tx) => {
      await lockQueueConfig(tx, queueConfig.id);

      const activeReservations = await tx.queueReservation.count({
        where: {
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
          queueEntry: {
            queueConfigId: queueConfig.id,
          },
        },
      });

      if (activeReservations < queueConfig.maxConcurrent) {
        const entry = await tx.queueEntry.create({
          data: {
            queueConfigId: queueConfig.id,
            sessionToken,
            position: 0,
            status: "ADMITTED",
            admittedAt: new Date(),
          },
        });

        const reservation = await tx.queueReservation.create({
          data: {
            queueEntryId: entry.id,
            programId: programId || queueConfig.programId || "",
            expiresAt: new Date(Date.now() + queueConfig.reservationMinutes * 60 * 1000),
          },
        });

        return { admitted: true as const, entry, reservation };
      }

      // Queue is full — add to waiting list
      const lastEntry = await tx.queueEntry.findFirst({
        where: {
          queueConfigId: queueConfig.id,
          status: "WAITING",
        },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      const nextPosition = (lastEntry?.position || 0) + 1;

      const entry = await tx.queueEntry.create({
        data: {
          queueConfigId: queueConfig.id,
          sessionToken,
          position: nextPosition,
          status: "WAITING",
        },
      });

      return { admitted: false as const, entry, position: nextPosition };
    });

    if (result.admitted) {
      return NextResponse.json({
        queued: false,
        canProceed: true,
        entry: result.entry,
        reservation: result.reservation,
        sessionToken,
        message: "You have been admitted to registration",
      });
    }

    const estimatedWait = calculateEstimatedWait(result.position, queueConfig);

    return NextResponse.json({
      queued: true,
      canProceed: false,
      entry: result.entry,
      sessionToken,
      position: result.position,
      estimatedWaitMinutes: estimatedWait,
      message: `You are #${result.position} in line`,
    });
  } catch (error) {
    console.error("Error entering queue:", error);
    return NextResponse.json({ error: "Failed to enter queue" }, { status: 500 });
  }
}

function checkQueueActive(config: any): boolean {
  if (!config.isEnabled) return false;

  switch (config.activationType) {
    case "ALWAYS":
      return true;
    case "SCHEDULED": {
      const now = new Date();
      if (config.scheduledStart && new Date(config.scheduledStart) > now) return false;
      if (config.scheduledEnd && new Date(config.scheduledEnd) < now) return false;
      return true;
    }
    case "THRESHOLD":
      return true;
    default:
      return true;
  }
}

async function getQueuePosition(entry: {
  queueConfigId: string;
  enteredAt: Date;
}): Promise<number> {
  const waitingAhead = await db.queueEntry.count({
    where: {
      queueConfigId: entry.queueConfigId,
      status: "WAITING",
      enteredAt: { lt: entry.enteredAt },
    },
  });
  return waitingAhead + 1;
}

function calculateEstimatedWait(position: number, config: any): number {
  const avgTime = 5;
  const slotsPerCycle = config.maxConcurrent;
  const cyclesNeeded = Math.ceil(position / slotsPerCycle);
  return cyclesNeeded * avgTime;
}
