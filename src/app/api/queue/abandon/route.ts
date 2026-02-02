import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// POST /api/queue/abandon - User leaves the queue
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

    if (entry.status === "COMPLETED" || entry.status === "ABANDONED") {
      return NextResponse.json({
        success: true,
        message: "Entry already finalized",
      })
    }

    const wasAdmitted = entry.status === "ADMITTED"
    const queueConfigId = entry.queueConfigId

    // Update entry and reservation in transaction
    await db.$transaction(async (tx) => {
      await tx.queueEntry.update({
        where: { id: entry.id },
        data: {
          status: "ABANDONED",
          exitedAt: new Date(),
        },
      })

      if (entry.reservation) {
        await tx.queueReservation.update({
          where: { id: entry.reservation.id },
          data: {
            status: "EXPIRED",
          },
        })
      }

      // If they were admitted, admit the next person
      if (wasAdmitted) {
        await admitNextInQueue(tx, queueConfigId)
      } else {
        // They were waiting, update positions
        await tx.queueEntry.updateMany({
          where: {
            queueConfigId: queueConfigId,
            status: "WAITING",
            enteredAt: { gt: entry.enteredAt },
          },
          data: {
            position: { decrement: 1 },
          },
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: "You have left the queue",
    })
  } catch (error) {
    console.error("Error abandoning queue:", error)
    return NextResponse.json(
      { error: "Failed to leave queue" },
      { status: 500 }
    )
  }
}

async function admitNextInQueue(tx: any, queueConfigId: string) {
  const config = await tx.registrationQueueConfig.findUnique({
    where: { id: queueConfigId },
  })

  if (!config) return

  const activeCount = await tx.queueReservation.count({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      queueEntry: {
        queueConfigId: queueConfigId,
      },
    },
  })

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
