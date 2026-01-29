import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
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
});

// Helper to check if user can access athlete (same org or parent)
async function canAccessAthlete(session: any, athleteId: string): Promise<boolean> {
  const organizationId = session.user.organizationId;
  
  // Check if athlete belongs to the user's organization
  const athlete = await db.athlete.findFirst({
    where: {
      id: athleteId,
      OR: [
        // Direct organization link
        { organizationId: organizationId },
        // Via guardian/family link
        {
          guardians: {
            some: {
              family: {
                organizationId: organizationId,
              },
            },
          },
        },
      ],
    },
  });

  return !!athlete;
}

// Helper to check if user is a parent of the athlete (via family link)
async function isParentOfAthlete(session: any, athleteId: string): Promise<boolean> {
  // Check if user has a family link to this athlete
  const family = await db.family.findFirst({
    where: {
      userId: session.user.id,
      guardians: {
        some: {
          athleteId: athleteId,
        },
      },
    },
  });

  return !!family;
}

// GET /api/athletes/[id]/medical
// Returns the athlete's medical information with custom question responses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: athleteId } = await params;

    // Verify access
    const hasAccess = await canAccessAthlete(session, athleteId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Get medical info with custom responses
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

    // Get organization's custom questions for context
    const athlete = await db.athlete.findUnique({
      where: { id: athleteId },
      select: { organizationId: true },
    });

    let customQuestions: any[] = [];
    if (athlete?.organizationId) {
      customQuestions = await db.customMedicalQuestion.findMany({
        where: {
          organizationId: athlete.organizationId,
          isActive: true,
        },
        orderBy: { displayOrder: "asc" },
      });
    }

    // Get organization's medical config
    let medicalConfig = null;
    if (athlete?.organizationId) {
      medicalConfig = await db.medicalFormConfig.findUnique({
        where: { organizationId: athlete.organizationId },
      });
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
      customQuestions,
      config: medicalConfig || {
        collectAllergies: true,
        collectMedications: true,
        collectConditions: true,
        collectEmergencyContact: true,
        collectDietaryRestrictions: false,
        collectInsuranceInfo: false,
      },
    });
  } catch (error) {
    console.error("Error fetching athlete medical info:", error);
    return NextResponse.json(
      { error: "Failed to fetch medical info" },
      { status: 500 }
    );
  }
}

// PUT /api/athletes/[id]/medical
// Create or update the athlete's medical information
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: athleteId } = await params;

    // Verify access
    const hasAccess = await canAccessAthlete(session, athleteId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Check if user has edit permission (admin/staff) or is a parent
    const isParent = await isParentOfAthlete(session, athleteId);
    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    const hasEditPermission = 
      isSuperAdmin ||
      permissions.includes("*") ||
      permissions.includes("athletes.edit") ||
      isParent;

    if (!hasEditPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = upsertMedicalInfoSchema.parse(body);
    const { customResponses, ...medicalData } = validatedData;

    // Upsert medical info
    const medicalInfo = await db.athleteMedicalInfo.upsert({
      where: { athleteId },
      update: {
        ...medicalData,
        lastUpdatedBy: session.user.id,
      },
      create: {
        athleteId,
        allergies: medicalData.allergies ?? [],
        medications: medicalData.medications ?? [],
        conditions: medicalData.conditions ?? [],
        dietaryRestrictions: medicalData.dietaryRestrictions ?? [],
        insuranceProvider: medicalData.insuranceProvider,
        insurancePolicyNumber: medicalData.insurancePolicyNumber,
        emergencyContactName: medicalData.emergencyContactName,
        emergencyContactPhone: medicalData.emergencyContactPhone,
        emergencyContactRelation: medicalData.emergencyContactRelation,
        additionalNotes: medicalData.additionalNotes,
        lastUpdatedBy: session.user.id,
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

    return NextResponse.json(updatedInfo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating athlete medical info:", error);
    return NextResponse.json(
      { error: "Failed to update medical info" },
      { status: 500 }
    );
  }
}
