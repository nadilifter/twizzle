import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

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
  // Required for public verification
  organizationId: z.string(),
  email: z.string().email(),
});

/**
 * Verify that the email has a family connection to this athlete's organization.
 * This prevents unauthorized access to athlete medical data.
 */
async function verifyAccess(
  athleteId: string,
  organizationId: string,
  email: string
): Promise<boolean> {
  // Verify athlete belongs to the organization
  const athlete = await db.athlete.findFirst({
    where: {
      id: athleteId,
      organizationId,
    },
  });

  if (!athlete) return false;

  // Verify the email corresponds to a family in this organization
  // that is a guardian of this athlete
  const family = await db.family.findFirst({
    where: {
      email,
      organizationId,
      guardians: {
        some: {
          athleteId,
        },
      },
    },
  });

  return !!family;
}

// GET /api/public/athletes/[id]/medical?organizationId=xxx&email=xxx
// Public endpoint - fetch athlete medical info for checkout flow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const email = searchParams.get("email");

    if (!organizationId || !email) {
      return NextResponse.json(
        { error: "organizationId and email are required" },
        { status: 400 }
      );
    }

    // Verify access
    const hasAccess = await verifyAccess(athleteId, organizationId, email);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

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
// Public endpoint - save/update athlete medical info progressively during checkout
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    const body = await request.json();
    const validatedData = upsertMedicalInfoSchema.parse(body);

    const { organizationId, email, customResponses, ...medicalData } = validatedData;

    // Verify access
    const hasAccess = await verifyAccess(athleteId, organizationId, email);
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
      allergies: medicalData.allergies ?? existing?.allergies ?? [],
      medications: medicalData.medications ?? existing?.medications ?? [],
      conditions: medicalData.conditions ?? existing?.conditions ?? [],
      dietaryRestrictions: medicalData.dietaryRestrictions ?? existing?.dietaryRestrictions ?? [],
      insuranceProvider: medicalData.insuranceProvider !== undefined
        ? medicalData.insuranceProvider
        : existing?.insuranceProvider ?? null,
      insurancePolicyNumber: medicalData.insurancePolicyNumber !== undefined
        ? medicalData.insurancePolicyNumber
        : existing?.insurancePolicyNumber ?? null,
      emergencyContactName: medicalData.emergencyContactName !== undefined
        ? medicalData.emergencyContactName
        : existing?.emergencyContactName ?? null,
      emergencyContactPhone: medicalData.emergencyContactPhone !== undefined
        ? medicalData.emergencyContactPhone
        : existing?.emergencyContactPhone ?? null,
      emergencyContactRelation: medicalData.emergencyContactRelation !== undefined
        ? medicalData.emergencyContactRelation
        : existing?.emergencyContactRelation ?? null,
      additionalNotes: medicalData.additionalNotes !== undefined
        ? medicalData.additionalNotes
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
