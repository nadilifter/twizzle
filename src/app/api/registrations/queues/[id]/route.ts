import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { getScopedDb } from "@/lib/db"
import { z } from "zod"

const updateQueueConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  reservationMinutes: z.number().min(1).max(60).optional(),
  maxConcurrent: z.number().min(1).max(1000).optional(),
  activationType: z.enum(["ALWAYS", "THRESHOLD", "SCHEDULED"]).optional(),
  activationThreshold: z.number().min(1).optional().nullable(),
  scheduledStart: z.string().datetime().optional().nullable(),
  scheduledEnd: z.string().datetime().optional().nullable(),
})

// GET /api/registrations/queues/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const scopedDb = getScopedDb(session.user.organizationId)

    const config = await scopedDb.registrationQueueConfig.findUnique({
      where: { id },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            level: true,
            status: true,
          },
        },
        _count: {
          select: {
            entries: true,
          },
        },
      },
    })

    if (!config) {
      return NextResponse.json(
        { error: "Queue configuration not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error("Error fetching queue config:", error)
    return NextResponse.json(
      { error: "Failed to fetch queue configuration" },
      { status: 500 }
    )
  }
}

// PATCH /api/registrations/queues/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("registrations.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateQueueConfigSchema.parse(body)
    const scopedDb = getScopedDb(session.user.organizationId)

    // Verify the config exists and belongs to this organization
    const existing = await scopedDb.registrationQueueConfig.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Queue configuration not found" },
        { status: 404 }
      )
    }

    const updateData: any = {}
    
    if (validatedData.isEnabled !== undefined) {
      updateData.isEnabled = validatedData.isEnabled
    }
    if (validatedData.reservationMinutes !== undefined) {
      updateData.reservationMinutes = validatedData.reservationMinutes
    }
    if (validatedData.maxConcurrent !== undefined) {
      updateData.maxConcurrent = validatedData.maxConcurrent
    }
    if (validatedData.activationType !== undefined) {
      updateData.activationType = validatedData.activationType
    }
    if (validatedData.activationThreshold !== undefined) {
      updateData.activationThreshold = validatedData.activationThreshold
    }
    if (validatedData.scheduledStart !== undefined) {
      updateData.scheduledStart = validatedData.scheduledStart 
        ? new Date(validatedData.scheduledStart) 
        : null
    }
    if (validatedData.scheduledEnd !== undefined) {
      updateData.scheduledEnd = validatedData.scheduledEnd 
        ? new Date(validatedData.scheduledEnd) 
        : null
    }

    const config = await scopedDb.registrationQueueConfig.update({
      where: { id },
      data: updateData,
      include: {
        program: {
          select: {
            id: true,
            name: true,
            level: true,
            status: true,
          },
        },
        _count: {
          select: {
            entries: true,
          },
        },
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating queue config:", error)
    return NextResponse.json(
      { error: "Failed to update queue configuration" },
      { status: 500 }
    )
  }
}

// DELETE /api/registrations/queues/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("registrations.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const scopedDb = getScopedDb(session.user.organizationId)

    // Verify the config exists
    const existing = await scopedDb.registrationQueueConfig.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Queue configuration not found" },
        { status: 404 }
      )
    }

    await scopedDb.registrationQueueConfig.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting queue config:", error)
    return NextResponse.json(
      { error: "Failed to delete queue configuration" },
      { status: 500 }
    )
  }
}
