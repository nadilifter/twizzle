import { db } from "@/lib/db";
import type { SkillDifficulty } from "@prisma/client";

/**
 * Template Auto-Sync Service
 * 
 * Handles automatic synchronization of skills in evaluation templates
 * based on configured level and category filters.
 */

interface SyncResult {
  templateId: string;
  added: number;
  removed: number;
  total: number;
}

/**
 * Sync skills for a single evaluation template based on its auto-sync configuration.
 * Only syncs if autoSyncEnabled is true.
 * 
 * @param templateId - The ID of the template to sync
 * @returns SyncResult with counts of added/removed skills
 */
export async function syncTemplateSkills(templateId: string): Promise<SyncResult> {
  const template = await db.evaluationTemplate.findUnique({
    where: { id: templateId },
    include: {
      skills: {
        select: { skillId: true },
      },
    },
  });

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  if (!template.autoSyncEnabled) {
    return {
      templateId,
      added: 0,
      removed: 0,
      total: template.skills.length,
    };
  }

  // Build the query for matching skills
  const whereClause: {
    organizationId: string;
    difficultyLevel?: { in: SkillDifficulty[] };
    category?: { in: string[] };
  } = {
    organizationId: template.organizationId,
  };

  // Filter by difficulty levels if specified
  if (template.autoSyncLevels.length > 0) {
    whereClause.difficultyLevel = {
      in: template.autoSyncLevels as SkillDifficulty[],
    };
  }

  // Filter by categories if specified
  if (template.autoSyncCategories.length > 0) {
    whereClause.category = {
      in: template.autoSyncCategories,
    };
  }

  // Get all matching skills
  const matchingSkills = await db.skill.findMany({
    where: whereClause,
    select: { id: true },
    orderBy: [
      { category: "asc" },
      { difficultyLevel: "asc" },
      { name: "asc" },
    ],
  });

  const matchingSkillIds = new Set(matchingSkills.map((s) => s.id));
  const currentSkillIds = new Set(template.skills.map((s) => s.skillId));

  // Calculate what needs to be added/removed
  const toAdd = [...matchingSkillIds].filter((id) => !currentSkillIds.has(id));
  const toRemove = [...currentSkillIds].filter((id) => !matchingSkillIds.has(id));

  // Perform the sync in a transaction
  await db.$transaction(async (tx) => {
    // Remove skills that no longer match
    if (toRemove.length > 0) {
      await tx.evaluationTemplateSkill.deleteMany({
        where: {
          templateId,
          skillId: { in: toRemove },
        },
      });
    }

    // Get the current max order to add new skills at the end
    const maxOrder = await tx.evaluationTemplateSkill.aggregate({
      where: { templateId },
      _max: { order: true },
    });
    let nextOrder = (maxOrder._max.order ?? -1) + 1;

    // Add new matching skills
    if (toAdd.length > 0) {
      await tx.evaluationTemplateSkill.createMany({
        data: toAdd.map((skillId) => ({
          templateId,
          skillId,
          order: nextOrder++,
          isRequired: true,
        })),
      });
    }

    // Update the template's updatedAt
    await tx.evaluationTemplate.update({
      where: { id: templateId },
      data: { updatedAt: new Date() },
    });
  });

  return {
    templateId,
    added: toAdd.length,
    removed: toRemove.length,
    total: matchingSkillIds.size,
  };
}

/**
 * Sync all templates that have auto-sync enabled for a specific organization.
 * Useful for batch syncing when skills are added/updated/deleted.
 * 
 * @param organizationId - The organization to sync templates for
 * @returns Array of SyncResults for each template
 */
export async function syncAllOrganizationTemplates(
  organizationId: string
): Promise<SyncResult[]> {
  const templates = await db.evaluationTemplate.findMany({
    where: {
      organizationId,
      autoSyncEnabled: true,
    },
    select: { id: true },
  });

  const results: SyncResult[] = [];

  for (const template of templates) {
    const result = await syncTemplateSkills(template.id);
    results.push(result);
  }

  return results;
}

/**
 * Check if a template would have any skills with the given auto-sync configuration.
 * Useful for previewing before enabling auto-sync.
 * 
 * @param organizationId - The organization ID
 * @param levels - Array of difficulty levels to include
 * @param categories - Array of categories to include
 * @returns Count of matching skills
 */
export async function previewAutoSyncSkills(
  organizationId: string,
  levels: string[],
  categories: string[]
): Promise<{ count: number; skills: Array<{ id: string; name: string; category: string; difficultyLevel: string }> }> {
  const whereClause: {
    organizationId: string;
    difficultyLevel?: { in: SkillDifficulty[] };
    category?: { in: string[] };
  } = {
    organizationId,
  };

  if (levels.length > 0) {
    whereClause.difficultyLevel = {
      in: levels as SkillDifficulty[],
    };
  }

  if (categories.length > 0) {
    whereClause.category = {
      in: categories,
    };
  }

  const skills = await db.skill.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      category: true,
      difficultyLevel: true,
    },
    orderBy: [
      { category: "asc" },
      { difficultyLevel: "asc" },
      { name: "asc" },
    ],
  });

  return {
    count: skills.length,
    skills,
  };
}

/**
 * Get unique categories from skills in an organization.
 * Useful for populating category selector in UI.
 * 
 * @param organizationId - The organization ID
 * @returns Array of unique category names
 */
export async function getSkillCategories(organizationId: string): Promise<string[]> {
  const result = await db.skill.findMany({
    where: { organizationId },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  return result.map((r) => r.category);
}
