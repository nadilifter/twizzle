import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { getScopedDb } from "@/lib/db"
import { z } from "zod"

const createQueueConfigSchema = z.object({
  programId: z.string().nullable().optional(),
  isEnabled: z.boolean().default(false),
  reservationMinutes: z.number().min(1).max(60).default(10),
  maxConcurrent: z.number().min(1).max(1000).default(50),
  activationType: z.enum(["ALWAYS", "THRESHOLD", "SCHEDULED"]).default("ALWAYS"),
  activationThreshold: z.number().min(1).optional().nullable(),
  scheduledStart: z.string().datetime().optional().nullable(),
  scheduledEnd: z.string().datetime().optional().nullable(),
})

// GET /api/registrations/queues
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeProgram = searchParams.get("include") === "program"
    const scopedDb = getScopedDb(session.user.organizationId)

    const configs = await scopedDb.registrationQueueConfig.findMany({
      include: {
        program: includeProgram ? {
          select: {
            id: true,
            name: true,
            level: true,
            status: true,
          },
        } : false,
        _count: {
          select: {
            entries: true,
          },
        },
      },
      orderBy: [
        { programId: "asc" }, // Global (null) first
        { createdAt: "desc" },
      ],
    })

    return NextResponse.json({ configs })
  } catch (error) {
    console.error("Error fetching queue configs:", error)
    return NextResponse.json(
      { error: "Failed to fetch queue configurations" },
      { status: 500 }
    )
  }
}

// POST /api/registrations/queues
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("registrations.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createQueueConfigSchema.parse(body)
    const scopedDb = getScopedDb(session.user.organizationId)

    // Check if a config already exists for this program (or global)
    const existing = await scopedDb.registrationQueueConfig.findFirst({
      where: {
        programId: validatedData.programId ?? null,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A queue configuration already exists for this scope" },
        { status: 400 }
      )
    }

    // If programId is provided, verify it belongs to the organization
    if (validatedData.programId) {
      const program = await scopedDb.program.findUnique({
        where: { id: validatedData.programId },
      })
      if (!program) {
        return NextResponse.json(
          { error: "Program not found" },
          { status: 404 }
        )
      }
    }

    const config = await scopedDb.registrationQueueConfig.create({
      data: {
        organizationId: session.user.organizationId,
        programId: validatedData.programId ?? null,
        isEnabled: validatedData.isEnabled,
        reservationMinutes: validatedData.reservationMinutes,
        maxConcurrent: validatedData.maxConcurrent,
        activationType: validatedData.activationType,
        activationThreshold: validatedData.activationThreshold ?? null,
        scheduledStart: validatedData.scheduledStart ? new Date(validatedData.scheduledStart) : null,
        scheduledEnd: validatedData.scheduledEnd ? new Date(validatedData.scheduledEnd) : null,
      },
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
    console.error("Error creating queue config:", error)
    return NextResponse.json(
      { error: "Failed to create queue configuration" },
      { status: 500 }
    )
  }
}
