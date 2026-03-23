import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { admitNextInQueue, lockQueueConfig } from "@/lib/queue-utils"

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      console.error("CRON_SECRET is not configured")
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      )
    }

    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const now = new Date()
    let expiredCount = 0
    let admittedCount = 0

    // Batch-fetch all expired reservations with their config
    const expiredReservations = await db.queueReservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: now },
      },
      include: {
        queueEntry: {
          select: { id: true, queueConfigId: true },
        },
      },
    })

    // Group by queueConfigId to minimize lock contention
    const byConfig = new Map<string, typeof expiredReservations>()
    for (const res of expiredReservations) {
      const configId = res.queueEntry.queueConfigId
      if (!byConfig.has(configId)) byConfig.set(configId, [])
      byConfig.get(configId)!.push(res)
    }

    for (const [queueConfigId, reservations] of byConfig) {
      await db.$transaction(async (tx) => {
        await lockQueueConfig(tx, queueConfigId)

        const reservationIds = reservations.map((r) => r.id)
        const entryIds = reservations.map((r) => r.queueEntryId)

        await tx.queueReservation.updateMany({
          where: { id: { in: reservationIds } },
          data: { status: "EXPIRED" },
        })

        await tx.queueEntry.updateMany({
          where: { id: { in: entryIds } },
          data: {
            status: "EXPIRED",
            exitedAt: now,
          },
        })

        expiredCount += reservations.length

        // Admit waiting users to fill all freed slots
        for (let i = 0; i < reservations.length; i++) {
          const admitted = await admitNextInQueue(tx, queueConfigId)
          if (!admitted) break
          admittedCount++
        }
      })
    }

    // Clean up old terminal entries (older than 24 hours)
    const cleanupThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const cleanedUp = await db.queueEntry.deleteMany({
      where: {
        status: { in: ["COMPLETED", "EXPIRED", "ABANDONED"] },
        exitedAt: { lt: cleanupThreshold },
      },
    })

    return NextResponse.json({
      success: true,
      expired: expiredCount,
      admitted: admittedCount,
      cleanedUp: cleanedUp.count,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error("Error in expire-reservations cron:", error)
    return NextResponse.json(
      { error: "Failed to process expired reservations" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
