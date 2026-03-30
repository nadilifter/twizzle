import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncTemplateSkills, previewAutoSyncSkills } from "@/lib/services/template-sync";

// POST /api/evaluation-templates/[id]/sync
// Manually trigger skill sync for a template
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if template exists and belongs to organization
    const template = await db.evaluationTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (!template.autoSyncEnabled) {
      return NextResponse.json(
        { error: "Auto-sync is not enabled for this template" },
        { status: 400 }
      );
    }

    // Perform the sync
    const result = await syncTemplateSkills(id);

    // Fetch the updated template
    const updatedTemplate = await db.evaluationTemplate.findUnique({
      where: { id },
      include: {
        skills: {
          include: {
            skill: true,
          },
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            evaluations: true,
          },
        },
      },
    });

    return NextResponse.json({
      template: updatedTemplate,
      syncResult: result,
    });
  } catch (error) {
    console.error("Error syncing template skills:", error);
    return NextResponse.json({ error: "Failed to sync template skills" }, { status: 500 });
  }
}

// GET /api/evaluation-templates/[id]/sync
// Preview what skills would be synced without making changes
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if template exists and belongs to organization
    const template = await db.evaluationTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        skills: {
          select: { skillId: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Preview what skills would match the current auto-sync config
    const preview = await previewAutoSyncSkills(
      session.user.organizationId,
      template.autoSyncLevels,
      template.autoSyncCategories
    );

    // Calculate what would be added/removed
    const currentSkillIds = new Set(template.skills.map((s) => s.skillId));
    const matchingSkillIds = new Set(preview.skills.map((s) => s.id));

    const toAdd = preview.skills.filter((s) => !currentSkillIds.has(s.id));
    const toRemove = [...currentSkillIds].filter((id) => !matchingSkillIds.has(id));

    return NextResponse.json({
      autoSyncEnabled: template.autoSyncEnabled,
      autoSyncLevels: template.autoSyncLevels,
      autoSyncCategories: template.autoSyncCategories,
      preview: {
        totalMatching: preview.count,
        currentCount: template.skills.length,
        toAdd: toAdd.length,
        toRemove: toRemove.length,
        matchingSkills: preview.skills,
      },
    });
  } catch (error) {
    console.error("Error previewing sync:", error);
    return NextResponse.json({ error: "Failed to preview sync" }, { status: 500 });
  }
}
