import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePublicRequest } from "@/lib/public-api";

/**
 * GET /api/public/medical-config?organizationId=xxx
 * Public endpoint - returns the organization's medical form configuration
 * and active custom questions. Used by competition registration flows that
 * need medical config without a program reference.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

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
      config: config || {
        id: null,
        organizationId,
        collectAllergies: true,
        collectMedications: true,
        collectConditions: true,
        collectEmergencyContact: true,
        collectDietaryRestrictions: false,
        collectInsuranceInfo: false,
        validityDays: 180,
      },
      customQuestions,
    });
  } catch (error) {
    console.error("Error fetching medical config:", error);
    return NextResponse.json(
      { error: "Failed to fetch medical config" },
      { status: 500 }
    );
  }
}
