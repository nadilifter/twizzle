import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { syncTemplateSkills } from "@/lib/services/template-sync";

const scoringTypeEnum = z.enum(["PASS_FAIL", "POINT_SCALE"]);
const completionTypeEnum = z.enum(["PERCENTAGE", "COUNT", "ALL"]);

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  levelId: z.string().optional().nullable(),
  minAge: z.number().int().min(0).max(100).optional().nullable(),
  maxAge: z.number().int().min(0).max(100).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  
  // Auto-sync configuration
  autoSyncEnabled: z.boolean().optional().default(false),
  autoSyncLevels: z.array(z.string()).optional().default([]),
  autoSyncCategories: z.array(z.string()).optional().default([]),
  
  // Scoring configuration
  scoringType: scoringTypeEnum.optional().default("PASS_FAIL"),
  pointScaleMin: z.number().int().min(0).max(100).optional().default(1),
  pointScaleMax: z.number().int().min(1).max(100).optional().default(10),
  pointScalePassThreshold: z.number().int().min(0).max(100).optional().default(7),
  
  // Completion requirements
  completionType: completionTypeEnum.optional().default("PERCENTAGE"),
  completionThreshold: z.number().min(0).max(100).optional().default(80),
  
  // Skills (optional if auto-sync enabled)
  skillIds: z.array(z.string()).optional(),
}).refine(
  (data) => data.autoSyncEnabled || (data.skillIds && data.skillIds.length > 0),
  { message: "Either enable auto-sync or provide at least one skill" }
);

// GET /api/evaluation-templates
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const levelId = searchParams.get("levelId");
    const isActive = searchParams.get("isActive");
    const minAge = searchParams.get("minAge");
    const maxAge = searchParams.get("maxAge");
    const scoringType = searchParams.get("scoringType");
    const programId = searchParams.get("programId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      organizationId: session.user.organizationId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(levelId && { levelId }),
      ...(isActive !== null && isActive !== undefined && { isActive: isActive === "true" }),
      ...(scoringType && { scoringType: scoringType as "PASS_FAIL" | "POINT_SCALE" }),
      // Filter by program assignment
      ...(programId && {
        programTemplates: {
          some: { programId },
        },
      }),
      // Filter templates appropriate for an athlete's age
      ...(minAge && {
        OR: [
          { minAge: null },
          { minAge: { lte: parseInt(minAge) } },
        ],
      }),
      ...(maxAge && {
        OR: [
          { maxAge: null },
          { maxAge: { gte: parseInt(maxAge) } },
        ],
      }),
    };

    const [templates, total] = await Promise.all([
      db.evaluationTemplate.findMany({
        where,
        include: {
          level: true,
          skills: {
            include: {
              skill: true,
            },
            orderBy: { order: "asc" },
          },
          programTemplates: {
            include: {
              program: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          achievements: {
            select: {
              id: true,
              name: true,
              badgeImageUrl: true,
            },
          },
          _count: {
            select: {
              evaluations: true,
            },
          },
        },
        orderBy: [{ name: "asc" }],
        take: limit,
        skip: offset,
      }),
      db.evaluationTemplate.count({ where }),
    ]);

    return NextResponse.json({
      data: templates,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching evaluation templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluation templates" },
      { status: 500 }
    );
  }
}

// POST /api/evaluation-templates
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createTemplateSchema.parse(body);

    const { skillIds, completionThreshold, ...templateData } = validatedData;

    // If not using auto-sync, verify all skills exist and belong to organization
    if (!validatedData.autoSyncEnabled && skillIds && skillIds.length > 0) {
      const skills = await db.skill.findMany({
        where: {
          id: { in: skillIds },
          organizationId: session.user.organizationId,
        },
      });

      if (skills.length !== skillIds.length) {
        return NextResponse.json(
          { error: "One or more skills not found" },
          { status: 400 }
        );
      }
    }

    // Validate point scale configuration
    if (templateData.scoringType === "POINT_SCALE") {
      if (templateData.pointScaleMin >= templateData.pointScaleMax) {
        return NextResponse.json(
          { error: "Point scale minimum must be less than maximum" },
          { status: 400 }
        );
      }
      if (templateData.pointScalePassThreshold < templateData.pointScaleMin ||
          templateData.pointScalePassThreshold > templateData.pointScaleMax) {
        return NextResponse.json(
          { error: "Pass threshold must be within the point scale range" },
          { status: 400 }
        );
      }
    }

    // Create the template
    const template = await db.evaluationTemplate.create({
      data: {
        ...templateData,
        completionThreshold,
        organizationId: session.user.organizationId,
        // Only add skills if not using auto-sync and skillIds provided
        ...((!validatedData.autoSyncEnabled && skillIds && skillIds.length > 0) && {
          skills: {
            create: skillIds.map((skillId, index) => ({
              skillId,
              order: index,
              isRequired: true,
            })),
          },
        }),
      },
      include: {
        level: true,
        skills: {
          include: {
            skill: true,
          },
          orderBy: { order: "asc" },
        },
        programTemplates: {
          include: {
            program: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        achievements: {
          select: {
            id: true,
            name: true,
            badgeImageUrl: true,
          },
        },
        _count: {
          select: {
            evaluations: true,
          },
        },
      },
    });

    // If auto-sync is enabled, sync the skills now
    if (validatedData.autoSyncEnabled) {
      await syncTemplateSkills(template.id);
      
      // Fetch the updated template with synced skills
      const updatedTemplate = await db.evaluationTemplate.findUnique({
        where: { id: template.id },
        include: {
          level: true,
          skills: {
            include: {
              skill: true,
            },
            orderBy: { order: "asc" },
          },
          programTemplates: {
            include: {
              program: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          achievements: {
            select: {
              id: true,
              name: true,
              badgeImageUrl: true,
            },
          },
          _count: {
            select: {
              evaluations: true,
            },
          },
        },
      });

      return NextResponse.json(updatedTemplate);
    }

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating evaluation template:", error);
    return NextResponse.json(
      { error: "Failed to create evaluation template" },
      { status: 500 }
    );
  }
}
