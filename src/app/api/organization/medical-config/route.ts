import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const medicalConfigSchema = z.object({
  collectAllergies: z.boolean().optional(),
  collectMedications: z.boolean().optional(),
  collectConditions: z.boolean().optional(),
  collectEmergencyContact: z.boolean().optional(),
  collectDietaryRestrictions: z.boolean().optional(),
  collectInsuranceInfo: z.boolean().optional(),
  requireDuringRegistration: z.boolean().optional(),
});

// GET /api/organization/medical-config
// Returns the organization's medical form configuration
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const config = await db.medicalFormConfig.findUnique({
      where: {
        organizationId: organizationId,
      },
    });

    // Return config or defaults if not yet created
    if (config) {
      return NextResponse.json(config);
    }

    // Return default config structure (not saved yet)
    return NextResponse.json({
      id: null,
      organizationId: organizationId,
      collectAllergies: true,
      collectMedications: true,
      collectConditions: true,
      collectEmergencyContact: true,
      collectDietaryRestrictions: false,
      collectInsuranceInfo: false,
      requireDuringRegistration: false,
    });
  } catch (error) {
    console.error("Error fetching medical config:", error);
    return NextResponse.json({ error: "Failed to fetch medical config" }, { status: 500 });
  }
}

// PUT /api/organization/medical-config
// Create or update the organization's medical form configuration
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Super admins bypass permission checks
    const isSuperAdmin = session.user.isSuperAdmin === true;
    
    if (!isSuperAdmin) {
      // Check if user has admin permissions
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organizationId,
            userId: session.user.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const body = await request.json();
    const validatedData = medicalConfigSchema.parse(body);

    const config = await db.medicalFormConfig.upsert({
      where: {
        organizationId: organizationId,
      },
      update: validatedData,
      create: {
        organizationId: organizationId,
        ...validatedData,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating medical config:", error);
    return NextResponse.json({ error: "Failed to update medical config" }, { status: 500 });
  }
}
