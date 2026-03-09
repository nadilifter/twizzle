import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseDateOnly } from "@/lib/date-utils"
import { sendEmail } from "@/lib/email"
import { getEnvConfig } from "@/lib/env-domains"
import { z } from "zod"

const approveSchema = z.object({
  categories: z.array(z.string()).optional(),
  targetDate: z.string().datetime().optional().nullable(),
})

// POST /api/superadmin/feedback/[id]/approve
// Accept submission, set isPublic=true, status=PLANNED, send email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const validatedData = approveSchema.parse(body)

    // Get the feature
    const feature = await db.featureRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 })
    }

    if (feature.isPublic) {
      return NextResponse.json({ error: "Feature is already public" }, { status: 400 })
    }

    // Update the feature
    const updatedFeature = await db.featureRequest.update({
      where: { id },
      data: {
        status: "PLANNED",
        isPublic: true,
        statusChangedAt: new Date(),
        ...(validatedData.categories && { categories: validatedData.categories }),
        ...(validatedData.targetDate !== undefined && {
          targetDate: validatedData.targetDate ? parseDateOnly(validatedData.targetDate) : null,
        }),
      },
    })

    // Send email notification to the submitter
    if (feature.user?.email) {
      const config = getEnvConfig()
      const feedbackUrl = `https://feedback.${config.baseDomain}`
      
      try {
        await sendEmail({
          to: [feature.user.email],
          subject: "Your feedback has been added to the Uplifter roadmap!",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">Great news, ${feature.user.name || "there"}!</h1>
              <p>Your feedback "<strong>${feature.title}</strong>" has been added to our product roadmap.</p>
              <p>We'll keep you updated as we make progress. You can track the status at:</p>
              <p><a href="${feedbackUrl}" style="color: #2563eb; text-decoration: underline;">View Roadmap</a></p>
              <p>Thank you for helping us improve Uplifter!</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="color: #6b7280; font-size: 14px;">The Uplifter Team</p>
            </div>
          `,
          text: `Great news, ${feature.user.name || "there"}!\n\nYour feedback "${feature.title}" has been added to our product roadmap.\n\nWe'll keep you updated as we make progress. You can track the status at: ${feedbackUrl}\n\nThank you for helping us improve Uplifter!\n\nThe Uplifter Team`,
        })
      } catch (emailError) {
        console.error("Failed to send approval email:", emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "Feature approved and added to roadmap",
      data: updatedFeature,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Error approving feature:", error)
    return NextResponse.json(
      { error: "Failed to approve feature" },
      { status: 500 }
    )
  }
}
