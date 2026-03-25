import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTodayNoonUTC } from "@/lib/date-utils"

/**
 * GET /api/user/recurring-charges
 *
 * List the authenticated guardian's recurring charges across all orgs.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    const where = { userId: session.user.id }

    const [charges, total] = await Promise.all([
      db.recurringCharge.findMany({
        where,
        include: {
          paymentMethod: {
            select: { id: true, last4: true, brand: true, type: true },
          },
          organization: {
            select: { id: true, name: true },
          },
          athlete: {
            select: { id: true, name: true },
          },
          athletePass: {
            select: { id: true, pass: { select: { name: true } } },
          },
          athleteMembership: {
            select: {
              id: true,
              instance: { select: { group: { select: { name: true } } } },
            },
          },
          enrollment: {
            select: { id: true, program: { select: { name: true } } },
          },
        },
        orderBy: { nextChargeDate: "asc" },
        take: limit,
        skip: offset,
      }),
      db.recurringCharge.count({ where }),
    ])

    return NextResponse.json({ data: charges, total, limit, offset })
  } catch (error) {
    console.error("Error fetching user recurring charges:", error)
    return NextResponse.json(
      { error: "Failed to fetch recurring charges" },
      { status: 500 }
    )
  }
}

const updateSchema = z.object({
  chargeId: z.string().min(1),
  paymentMethodId: z.string().min(1),
})

/**
 * PATCH /api/user/recurring-charges
 *
 * Update the payment method on a recurring charge.
 * If the charge is FAILED, resetting the payment method also reactivates
 * it for retry on the next cron run.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { chargeId, paymentMethodId } = updateSchema.parse(body)

    // Verify the charge belongs to this user
    const charge = await db.recurringCharge.findFirst({
      where: { id: chargeId, userId: session.user.id },
      select: { id: true, status: true },
    })

    if (!charge) {
      return NextResponse.json({ error: "Charge not found" }, { status: 404 })
    }

    // Verify the payment method belongs to this user
    const paymentMethod = await db.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId: session.user.id },
      select: { id: true },
    })

    if (!paymentMethod) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      paymentMethodId,
    }

    // If charge was FAILED, reactivate it for retry on the next cron run
    if (charge.status === "FAILED") {
      updateData.status = "ACTIVE"
      updateData.failureCount = 0
      updateData.nextChargeDate = getTodayNoonUTC()
    }

    const updated = await db.recurringCharge.update({
      where: { id: chargeId },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error updating recurring charge:", error)
    return NextResponse.json(
      { error: "Failed to update recurring charge" },
      { status: 500 }
    )
  }
}
