import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { resolvePublicRequest } from "@/lib/public-api";
import { getAuthSession } from "@/lib/auth";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const upsertMedicalInfoSchema = z.object({
  allergies: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  insuranceProvider: z.string().optional().nullable(),
  insurancePolicyNumber: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  customResponses: z.array(z.object({
    questionId: z.string(),
    response: z.string(),
  })).optional(),
  organizationId: z.string(),
  email: z.string().email(),
});

/**
 * Verify the user (by email) is a guardian of the athlete.
 * The organization ID is only used downstream for fetching medical config —
 * it doesn't gate access, because the athlete may be registering for a
 * program at an organization they haven't joined yet.
 */
async function verifyGuardian(
  athleteId: string,
  email: string,
): Promise<boolean> {
  const guardian = await db.athleteGuardian.findFirst({
    where: {
      athleteId,
      user: { email },
    },
    select: { id: true },
  });
  return !!guardian;
}

// GET /api/public/athletes/[id]/medical?organizationId=xxx&email=xxx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimited = await checkApiRateLimit(request, "medical", RATE_LIMITS.medical);
    if (rateLimited) return rateLimited;

    const { id: athleteId } = await params;
    const { searchParams } = new URL(request.url);
    const paramEmail = searchParams.get("email");

    const orgResult = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (orgResult instanceof NextResponse) return orgResult;
    const { organizationId } = orgResult;

    // Prefer session email over client-provided email to prevent
    // authenticated users from querying other guardians' athletes
    const session = await getAuthSession();
    const email = session?.user?.email || paramEmail;

    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    const hasAccess = await verifyGuardian(athleteId, email);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get the organization's medical form config for validity window
    const medicalConfig = await db.medicalFormConfig.findUnique({
      where: { organizationId },
      select: { validityDays: true },
    });

    const validityDays = medicalConfig?.validityDays ?? 180;

    // Get existing medical info
    const medicalInfo = await db.athleteMedicalInfo.findUnique({
      where: { athleteId },
      include: {
        customResponses: {
          include: {
            question: true,
          },
        },
      },
    });

    // Determine if the medical info is still current (within validity window)
    let isCurrent = false;
    if (medicalInfo?.updatedAt) {
      const updatedAt = new Date(medicalInfo.updatedAt);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - validityDays);
      isCurrent = updatedAt >= cutoff;
    }

    return NextResponse.json({
      medicalInfo: medicalInfo || {
        id: null,
        athleteId,
        allergies: [],
        medications: [],
        conditions: [],
        dietaryRestrictions: [],
        insuranceProvider: null,
        insurancePolicyNumber: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelation: null,
        additionalNotes: null,
        customResponses: [],
      },
      isCurrent,
      validityDays,
    });
  } catch (error) {
    console.error("Error fetching athlete medical info (public):", error);
    return NextResponse.json(
      { error: "Failed to fetch medical info" },
      { status: 500 }
    );
  }
}

// PUT /api/public/athletes/[id]/medical
// Requires authentication - writing PHI must have a verified session
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimited = await checkApiRateLimit(request, "medical", RATE_LIMITS.medical);
    if (rateLimited) return rateLimited;

    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: athleteId } = await params;
    const body = await request.json();
    const validatedData = upsertMedicalInfoSchema.parse(body);

    const orgResult = await resolvePublicRequest(request, validatedData.organizationId);
    if (orgResult instanceof NextResponse) return orgResult;

    const { organizationId: _orgId, email: _email, customResponses, ...medicalFields } = validatedData;

    // Always use session email for guardian verification on writes
    const hasAccess = await verifyGuardian(athleteId, session.user.email);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Upsert medical info - merge with existing data
    const existing = await db.athleteMedicalInfo.findUnique({
      where: { athleteId },
    });

    const mergedData = {
      allergies: medicalFields.allergies ?? existing?.allergies ?? [],
      medications: medicalFields.medications ?? existing?.medications ?? [],
      conditions: medicalFields.conditions ?? existing?.conditions ?? [],
      dietaryRestrictions: medicalFields.dietaryRestrictions ?? existing?.dietaryRestrictions ?? [],
      insuranceProvider: medicalFields.insuranceProvider !== undefined
        ? medicalFields.insuranceProvider
        : existing?.insuranceProvider ?? null,
      insurancePolicyNumber: medicalFields.insurancePolicyNumber !== undefined
        ? medicalFields.insurancePolicyNumber
        : existing?.insurancePolicyNumber ?? null,
      emergencyContactName: medicalFields.emergencyContactName !== undefined
        ? medicalFields.emergencyContactName
        : existing?.emergencyContactName ?? null,
      emergencyContactPhone: medicalFields.emergencyContactPhone !== undefined
        ? medicalFields.emergencyContactPhone
        : existing?.emergencyContactPhone ?? null,
      emergencyContactRelation: medicalFields.emergencyContactRelation !== undefined
        ? medicalFields.emergencyContactRelation
        : existing?.emergencyContactRelation ?? null,
      additionalNotes: medicalFields.additionalNotes !== undefined
        ? medicalFields.additionalNotes
        : existing?.additionalNotes ?? null,
    };

    const medicalInfo = await db.athleteMedicalInfo.upsert({
      where: { athleteId },
      update: {
        ...mergedData,
        lastUpdatedBy: "checkout",
      },
      create: {
        athleteId,
        ...mergedData,
        lastUpdatedBy: "checkout",
      },
    });

    // Handle custom responses if provided
    if (customResponses && customResponses.length > 0) {
      for (const response of customResponses) {
        await db.customMedicalResponse.upsert({
          where: {
            medicalInfoId_questionId: {
              medicalInfoId: medicalInfo.id,
              questionId: response.questionId,
            },
          },
          update: {
            response: response.response,
          },
          create: {
            medicalInfoId: medicalInfo.id,
            questionId: response.questionId,
            response: response.response,
          },
        });
      }
    }

    // Fetch updated info with responses
    const updatedInfo = await db.athleteMedicalInfo.findUnique({
      where: { athleteId },
      include: {
        customResponses: {
          include: {
            question: true,
          },
        },
      },
    });

    return NextResponse.json({ medicalInfo: updatedInfo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating athlete medical info (public):", error);
    return NextResponse.json(
      { error: "Failed to update medical info" },
      { status: 500 }
    );
  }
}
