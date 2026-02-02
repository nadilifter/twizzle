import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// POST /api/queue/complete - Mark registration as complete
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionToken } = body

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Session token is required" },
        { status: 400 }
      )
    }

    // Find the queue entry
    const entry = await db.queueEntry.findUnique({
      where: { sessionToken },
      include: { reservation: true },
    })

    if (!entry) {
      return NextResponse.json(
        { error: "Queue entry not found" },
        { status: 404 }
      )
    }

    if (entry.status !== "ADMITTED") {
      return NextResponse.json(
        { error: "Entry is not in admitted status" },
        { status: 400 }
      )
    }

    // Update entry and reservation in transaction
    await db.$transaction(async (tx) => {
      await tx.queueEntry.update({
        where: { id: entry.id },
        data: {
          status: "COMPLETED",
          exitedAt: new Date(),
        },
      })

      if (entry.reservation) {
        await tx.queueReservation.update({
          where: { id: entry.reservation.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        })
      }

      // Admit the next person in queue
      await admitNextInQueue(tx, entry.queueConfigId)
    })

    return NextResponse.json({
      success: true,
      message: "Registration completed successfully",
    })
  } catch (error) {
    console.error("Error completing registration:", error)
    return NextResponse.json(
      { error: "Failed to complete registration" },
      { status: 500 }
    )
  }
}

async function admitNextInQueue(tx: any, queueConfigId: string) {
  // Find the queue config to get max concurrent
  const config = await tx.registrationQueueConfig.findUnique({
    where: { id: queueConfigId },
  })

  if (!config) return

  // Count current active reservations
  const activeCount = await tx.queueReservation.count({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      queueEntry: {
        queueConfigId: queueConfigId,
      },
    },
  })

  // If we have room, admit the next waiting person
  if (activeCount < config.maxConcurrent) {
    const nextEntry = await tx.queueEntry.findFirst({
      where: {
        queueConfigId: queueConfigId,
        status: "WAITING",
      },
      orderBy: { enteredAt: "asc" },
    })

    if (nextEntry) {
      await tx.queueEntry.update({
        where: { id: nextEntry.id },
        data: {
          status: "ADMITTED",
          admittedAt: new Date(),
        },
      })

      await tx.queueReservation.create({
        data: {
          queueEntryId: nextEntry.id,
          programId: config.programId || "",
          expiresAt: new Date(Date.now() + config.reservationMinutes * 60 * 1000),
        },
      })

      // Update positions for remaining waiting entries
      await tx.queueEntry.updateMany({
        where: {
          queueConfigId: queueConfigId,
          status: "WAITING",
          enteredAt: { gt: nextEntry.enteredAt },
        },
        data: {
          position: { decrement: 1 },
        },
      })
    }
  }
}
