import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { getEnvConfig } from "@/lib/env-domains"
import { z } from "zod"

const mergeSchema = z.object({
  targetFeatureId: z.string().min(1, "Target feature ID is required"),
})

// POST /api/superadmin/feedback/[id]/merge
// Merge submission into an existing feature, send email to submitter
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
    const body = await request.json()
    const validatedData = mergeSchema.parse(body)

    // Prevent merging into itself
    if (id === validatedData.targetFeatureId) {
      return NextResponse.json({ error: "Cannot merge a feature into itself" }, { status: 400 })
    }

    // Get the source feature (the one being merged)
    const sourceFeature = await db.featureRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        votes: true,
      },
    })

    if (!sourceFeature) {
      return NextResponse.json({ error: "Source feature not found" }, { status: 404 })
    }

    // Get the target feature (the one being merged into)
    const targetFeature = await db.featureRequest.findUnique({
      where: { id: validatedData.targetFeatureId },
      select: { id: true, title: true, isPublic: true },
    })

    if (!targetFeature) {
      return NextResponse.json({ error: "Target feature not found" }, { status: 404 })
    }

    // Use transaction to ensure consistency
    await db.$transaction(async (tx) => {
      // Transfer votes from source to target (avoiding duplicates)
      for (const vote of sourceFeature.votes) {
        // Check if user already voted on target
        const existingVote = await tx.featureVote.findUnique({
          where: {
            featureRequestId_userId: {
              featureRequestId: validatedData.targetFeatureId,
              userId: vote.userId,
            },
          },
        })

        if (!existingVote) {
          await tx.featureVote.create({
            data: {
              featureRequestId: validatedData.targetFeatureId,
              userId: vote.userId,
            },
          })
        }
      }

      // Update the source feature to point to the target
      await tx.featureRequest.update({
        where: { id },
        data: {
          mergedIntoId: validatedData.targetFeatureId,
          status: "CLOSED",
          isPublic: false, // Hide merged features from public
        },
      })
    })

    // Send email notification to the submitter
    if (sourceFeature.user?.email) {
      const config = getEnvConfig()
      const feedbackUrl = `https://feedback.${config.baseDomain}`
      
      try {
        await sendEmail({
          to: [sourceFeature.user.email],
          subject: "Your feedback has been added to the Uplifter roadmap!",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">Great news, ${sourceFeature.user.name || "there"}!</h1>
              <p>Your feedback "<strong>${sourceFeature.title}</strong>" has been merged into an existing feature on our roadmap:</p>
              <p style="background: #f3f4f6; padding: 12px; border-radius: 8px;"><strong>${targetFeature.title}</strong></p>
              <p>We've combined similar requests to help us prioritize better. Your votes have been transferred to the combined feature.</p>
              <p>Track the progress at:</p>
              <p><a href="${feedbackUrl}" style="color: #2563eb; text-decoration: underline;">View Roadmap</a></p>
              <p>Thank you for helping us improve Uplifter!</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="color: #6b7280; font-size: 14px;">The Uplifter Team</p>
            </div>
          `,
          text: `Great news, ${sourceFeature.user.name || "there"}!\n\nYour feedback "${sourceFeature.title}" has been merged into an existing feature on our roadmap: "${targetFeature.title}"\n\nWe've combined similar requests to help us prioritize better. Your votes have been transferred to the combined feature.\n\nTrack the progress at: ${feedbackUrl}\n\nThank you for helping us improve Uplifter!\n\nThe Uplifter Team`,
        })
      } catch (emailError) {
        console.error("Failed to send merge email:", emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Feature merged into "${targetFeature.title}"`,
      data: {
        mergedInto: {
          id: targetFeature.id,
          title: targetFeature.title,
        },
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Error merging feature:", error)
    return NextResponse.json(
      { error: "Failed to merge feature" },
      { status: 500 }
    )
  }
}
