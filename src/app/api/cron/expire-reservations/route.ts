import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// This endpoint is called by a cron job (e.g., Vercel Cron) every minute
// to expire old reservations and admit the next users in queue

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

    // Find all expired reservations
    const expiredReservations = await db.queueReservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: now },
      },
      include: {
        queueEntry: {
          include: {
            queueConfig: true,
          },
        },
      },
    })

    // Process each expired reservation
    for (const reservation of expiredReservations) {
      await db.$transaction(async (tx) => {
        // Mark reservation as expired
        await tx.queueReservation.update({
          where: { id: reservation.id },
          data: { status: "EXPIRED" },
        })

        // Update queue entry status
        await tx.queueEntry.update({
          where: { id: reservation.queueEntryId },
          data: {
            status: "EXPIRED",
            exitedAt: now,
          },
        })

        expiredCount++

        // Admit the next person in queue
        const queueConfigId = reservation.queueEntry.queueConfigId
        const config = reservation.queueEntry.queueConfig

        if (config) {
          // Count current active reservations for this config
          const activeCount = await tx.queueReservation.count({
            where: {
              status: "ACTIVE",
              expiresAt: { gt: now },
              queueEntry: {
                queueConfigId: queueConfigId,
              },
            },
          })

          // If there's room, admit the next waiting user
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
                  admittedAt: now,
                },
              })

              await tx.queueReservation.create({
                data: {
                  queueEntryId: nextEntry.id,
                  programId: config.programId || "",
                  expiresAt: new Date(now.getTime() + config.reservationMinutes * 60 * 1000),
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

              admittedCount++
            }
          }
        }
      })
    }

    // Also clean up old abandoned/completed entries (older than 24 hours)
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

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
