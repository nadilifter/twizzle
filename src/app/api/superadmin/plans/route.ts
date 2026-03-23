import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const featureTogglesSchema = z.object({
  events: z.boolean(),
  competitions: z.boolean(),
  sms: z.boolean(),
  emailCampaigns: z.boolean(),
  customDomains: z.boolean(),
  accountingIntegrations: z.boolean(),
  training: z.boolean(),
  pointOfSale: z.boolean(),
}).optional()

const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional().nullable(),
  monthlyPrice: z.number().min(0),
  yearlyPrice: z.number().min(0).optional().nullable(),
  transactionFee: z.number().min(0).max(1), // 0-100%
  perTransactionFee: z.number().min(0),
  maxAthletes: z.number().int().positive().optional().nullable(),
  maxUsers: z.number().int().positive().optional().nullable(),
  maxPrograms: z.number().int().positive().optional().nullable(),
  maxEvents: z.number().int().positive().optional().nullable(),
  // SMS Limits
  smsIncluded: z.number().int().nonnegative().optional().nullable(),
  smsOverageRate: z.number().min(0).optional().nullable(),
  // Email Limits
  emailIncluded: z.number().int().nonnegative().optional().nullable(),
  emailOverageRate: z.number().min(0).optional().nullable(),
  // Storage Limits
  maxStorageMB: z.number().int().positive().optional().nullable(),
  // Membership Limits
  maxMembershipTypes: z.number().int().positive().optional().nullable(),
  features: z.array(z.string()),
  featureToggles: featureTogglesSchema,
  isPopular: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
})

// GET /api/superadmin/plans - List all subscription plans
export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const plans = await db.subscriptionPlan.findMany({
      include: {
        _count: {
          select: { subscriptions: true }
        }
      },
      orderBy: { displayOrder: "asc" }
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error("Error fetching plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    )
  }
}

// POST /api/superadmin/plans - Create a new plan
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createPlanSchema.parse(body)

    // Check if slug already exists
    const existingPlan = await db.subscriptionPlan.findUnique({
      where: { slug: validatedData.slug }
    })

    if (existingPlan) {
      return NextResponse.json(
        { error: "A plan with this slug already exists" },
        { status: 400 }
      )
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        monthlyPrice: validatedData.monthlyPrice,
        yearlyPrice: validatedData.yearlyPrice,
        transactionFee: validatedData.transactionFee,
        perTransactionFee: validatedData.perTransactionFee,
        maxAthletes: validatedData.maxAthletes,
        maxUsers: validatedData.maxUsers,
        maxPrograms: validatedData.maxPrograms,
        maxEvents: validatedData.maxEvents,
        smsIncluded: validatedData.smsIncluded,
        smsOverageRate: validatedData.smsOverageRate,
        emailIncluded: validatedData.emailIncluded,
        emailOverageRate: validatedData.emailOverageRate,
        maxStorageMB: validatedData.maxStorageMB,
        maxMembershipTypes: validatedData.maxMembershipTypes,
        features: validatedData.features,
        featureToggles: validatedData.featureToggles ?? {},
        isPopular: validatedData.isPopular ?? false,
        displayOrder: validatedData.displayOrder ?? 0,
        isActive: validatedData.isActive ?? true,
        isPublic: validatedData.isPublic ?? true,
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues?.[0]?.message || "Validation error"
      return NextResponse.json(
        { error: message },
        { status: 400 }
      )
    }
    console.error("Error creating plan:", error)
    return NextResponse.json(
      { error: "Failed to create plan" },
      { status: 500 }
    )
  }
}
