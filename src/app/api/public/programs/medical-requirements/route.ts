import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/public/programs/medical-requirements?programIds=id1,id2&organizationId=xxx
// Public endpoint - check if any programs require medical information
// Returns the org's medical config and custom questions if medical is required
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programIdsParam = searchParams.get("programIds");
    const organizationId = searchParams.get("organizationId");

    if (!programIdsParam || !organizationId) {
      return NextResponse.json(
        { error: "programIds and organizationId are required" },
        { status: 400 }
      );
    }

    const programIds = programIdsParam.split(",").filter(Boolean);

    // Check if any of the programs have hasMedicalRequirement enabled
    const programsWithMedical = await db.program.findMany({
      where: {
        id: { in: programIds },
        organizationId,
        hasMedicalRequirement: true,
      },
      select: { id: true },
    });

    if (programsWithMedical.length === 0) {
      return NextResponse.json({
        required: false,
        programIdsRequiringMedical: [],
        config: null,
        customQuestions: [],
      });
    }

    // Fetch the organization's medical form config
    const config = await db.medicalFormConfig.findUnique({
      where: { organizationId },
    });

    // Fetch active custom questions
    const customQuestions = await db.customMedicalQuestion.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({
      required: true,
      programIdsRequiringMedical: programsWithMedical.map((p) => p.id),
      config: config || {
        id: null,
        organizationId,
        collectAllergies: true,
        collectMedications: true,
        collectConditions: true,
        collectEmergencyContact: true,
        collectDietaryRestrictions: false,
        collectInsuranceInfo: false,
      },
      customQuestions,
    });
  } catch (error) {
    console.error("Error fetching medical requirements:", error);
    return NextResponse.json(
      { error: "Failed to fetch medical requirements" },
      { status: 500 }
    );
  }
}
