import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/queue/status - Get current queue status for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionToken = searchParams.get("sessionToken")

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Session token is required" },
        { status: 400 }
      )
    }

    // Find the queue entry
    const entry = await db.queueEntry.findUnique({
      where: { sessionToken },
      include: {
        reservation: true,
        queueConfig: true,
      },
    })

    if (!entry) {
      return NextResponse.json({
        inQueue: false,
        message: "No queue entry found for this session",
      })
    }

    // If admitted with active reservation
    if (entry.status === "ADMITTED" && entry.reservation) {
      const now = new Date()
      const expiresAt = new Date(entry.reservation.expiresAt)
      
      if (expiresAt > now) {
        const remainingSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
        
        return NextResponse.json({
          inQueue: false,
          canProceed: true,
          status: "ADMITTED",
          reservation: {
            id: entry.reservation.id,
            expiresAt: entry.reservation.expiresAt,
            remainingSeconds,
            programId: entry.reservation.programId,
          },
          message: "You have an active reservation",
        })
      } else {
        // Reservation expired
        return NextResponse.json({
          inQueue: false,
          canProceed: false,
          status: "EXPIRED",
          message: "Your reservation has expired",
        })
      }
    }

    // If waiting in queue
    if (entry.status === "WAITING") {
      // Calculate current position
      const position = await db.queueEntry.count({
        where: {
          queueConfigId: entry.queueConfigId,
          status: "WAITING",
          enteredAt: { lt: entry.enteredAt },
        },
      }) + 1

      // Calculate estimated wait
      const estimatedWait = calculateEstimatedWait(position, entry.queueConfig)

      return NextResponse.json({
        inQueue: true,
        canProceed: false,
        status: "WAITING",
        position,
        totalWaiting: await db.queueEntry.count({
          where: {
            queueConfigId: entry.queueConfigId,
            status: "WAITING",
          },
        }),
        estimatedWaitMinutes: estimatedWait,
        message: `You are #${position} in line`,
      })
    }

    // Other statuses (COMPLETED, EXPIRED, ABANDONED)
    return NextResponse.json({
      inQueue: false,
      canProceed: false,
      status: entry.status,
      message: getStatusMessage(entry.status),
    })
  } catch (error) {
    console.error("Error getting queue status:", error)
    return NextResponse.json(
      { error: "Failed to get queue status" },
      { status: 500 }
    )
  }
}

function calculateEstimatedWait(position: number, config: any): number {
  const avgTime = 5 // minutes per registration
  const slotsPerCycle = config?.maxConcurrent || 50
  const cyclesNeeded = Math.ceil(position / slotsPerCycle)
  return cyclesNeeded * avgTime
}

function getStatusMessage(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "Registration completed successfully"
    case "EXPIRED":
      return "Your reservation has expired"
    case "ABANDONED":
      return "You left the queue"
    default:
      return "Unknown status"
  }
}
