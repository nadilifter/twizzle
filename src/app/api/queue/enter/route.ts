import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"

// POST /api/queue/enter - Enter the queue for a program
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { programId, organizationSlug, sessionToken: existingToken } = body

    if (!organizationSlug) {
      return NextResponse.json(
        { error: "Organization slug is required" },
        { status: 400 }
      )
    }

    // Find the organization by slug
    const organization = await db.organization.findUnique({
      where: { slug: organizationSlug },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Find the queue config (program-specific or global)
    let queueConfig = null
    
    if (programId) {
      // First try program-specific
      queueConfig = await db.registrationQueueConfig.findFirst({
        where: {
          organizationId: organization.id,
          programId: programId,
          isEnabled: true,
        },
      })
    }
    
    // If no program-specific config, try global
    if (!queueConfig) {
      queueConfig = await db.registrationQueueConfig.findFirst({
        where: {
          organizationId: organization.id,
          programId: null,
          isEnabled: true,
        },
      })
    }

    // If no queue config is enabled, user can proceed directly
    if (!queueConfig) {
      return NextResponse.json({
        queued: false,
        canProceed: true,
        message: "No queue active, proceed to registration",
      })
    }

    // Check if queue is actually active based on activation type
    const isQueueActive = checkQueueActive(queueConfig)
    if (!isQueueActive) {
      return NextResponse.json({
        queued: false,
        canProceed: true,
        message: "Queue is not currently active",
      })
    }

    // Check if user already has an entry with this session token
    if (existingToken) {
      const existingEntry = await db.queueEntry.findUnique({
        where: { sessionToken: existingToken },
        include: { reservation: true },
      })

      if (existingEntry) {
        // User already in queue or has reservation
        if (existingEntry.status === "ADMITTED" && existingEntry.reservation) {
          // Check if reservation is still valid
          if (new Date(existingEntry.reservation.expiresAt) > new Date()) {
            return NextResponse.json({
              queued: false,
              canProceed: true,
              entry: existingEntry,
              reservation: existingEntry.reservation,
              message: "You have an active reservation",
            })
          }
        }
        
        if (existingEntry.status === "WAITING") {
          // Return current position
          const position = await getQueuePosition(existingEntry.id, queueConfig.id)
          const estimatedWait = calculateEstimatedWait(position, queueConfig)
          
          return NextResponse.json({
            queued: true,
            canProceed: false,
            entry: { ...existingEntry, position },
            position,
            estimatedWaitMinutes: estimatedWait,
            message: `You are #${position} in line`,
          })
        }
      }
    }

    // Check current active reservations
    const activeReservations = await db.queueReservation.count({
      where: {
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
        queueEntry: {
          queueConfigId: queueConfig.id,
        },
      },
    })

    // If there's room, admit immediately
    if (activeReservations < queueConfig.maxConcurrent) {
      const sessionToken = existingToken || uuidv4()
      
      // Create entry and reservation in one transaction
      const result = await db.$transaction(async (tx) => {
        const entry = await tx.queueEntry.create({
          data: {
            queueConfigId: queueConfig.id,
            sessionToken,
            position: 0, // Immediate admission
            status: "ADMITTED",
            admittedAt: new Date(),
          },
        })

        const reservation = await tx.queueReservation.create({
          data: {
            queueEntryId: entry.id,
            programId: programId || queueConfig.programId || "",
            expiresAt: new Date(Date.now() + queueConfig.reservationMinutes * 60 * 1000),
          },
        })

        return { entry, reservation }
      })

      return NextResponse.json({
        queued: false,
        canProceed: true,
        entry: result.entry,
        reservation: result.reservation,
        sessionToken,
        message: "You have been admitted to registration",
      })
    }

    // Otherwise, add to queue
    const sessionToken = existingToken || uuidv4()
    
    // Get the next position
    const lastEntry = await db.queueEntry.findFirst({
      where: {
        queueConfigId: queueConfig.id,
        status: "WAITING",
      },
      orderBy: { position: "desc" },
    })
    
    const nextPosition = (lastEntry?.position || 0) + 1

    const entry = await db.queueEntry.create({
      data: {
        queueConfigId: queueConfig.id,
        sessionToken,
        position: nextPosition,
        status: "WAITING",
      },
    })

    const estimatedWait = calculateEstimatedWait(nextPosition, queueConfig)

    return NextResponse.json({
      queued: true,
      canProceed: false,
      entry,
      sessionToken,
      position: nextPosition,
      estimatedWaitMinutes: estimatedWait,
      message: `You are #${nextPosition} in line`,
    })
  } catch (error) {
    console.error("Error entering queue:", error)
    return NextResponse.json(
      { error: "Failed to enter queue" },
      { status: 500 }
    )
  }
}

function checkQueueActive(config: any): boolean {
  if (!config.isEnabled) return false
  
  switch (config.activationType) {
    case "ALWAYS":
      return true
    case "SCHEDULED":
      const now = new Date()
      if (config.scheduledStart && new Date(config.scheduledStart) > now) return false
      if (config.scheduledEnd && new Date(config.scheduledEnd) < now) return false
      return true
    case "THRESHOLD":
      // Threshold is checked elsewhere based on concurrent users
      return true
    default:
      return true
  }
}

async function getQueuePosition(entryId: string, configId: string): Promise<number> {
  const waitingAhead = await db.queueEntry.count({
    where: {
      queueConfigId: configId,
      status: "WAITING",
      enteredAt: {
        lt: (await db.queueEntry.findUnique({ where: { id: entryId } }))?.enteredAt,
      },
    },
  })
  return waitingAhead + 1
}

function calculateEstimatedWait(position: number, config: any): number {
  // Average time per registration (assume 5 minutes if no data)
  const avgTime = 5
  // Factor in concurrent slots
  const slotsPerCycle = config.maxConcurrent
  const cyclesNeeded = Math.ceil(position / slotsPerCycle)
  return cyclesNeeded * avgTime
}
