import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { admitNextInQueue, lockQueueConfig } from "@/lib/queue-utils"

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

    await db.$transaction(async (tx) => {
      await lockQueueConfig(tx, queueConfigId)

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

      if (wasAdmitted) {
        await admitNextInQueue(tx, queueConfigId)
      } else {
        await tx.queueEntry.updateMany({
          where: {
            queueConfigId,
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
