import { db } from "@/lib/db";
import type { CompletionType, ScoringType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Achievement Service
 * 
 * Handles achievement completion checking and awarding for evaluation templates.
 */

interface EvaluationSkillData {
  skillId: string;
  passed: boolean;
  pointScore: number | null;
  attemptStatus: string;
  skill: {
    category: string;
  };
}

interface TemplateData {
  id: string;
  completionType: CompletionType;
  completionThreshold: Decimal;
  scoringType: ScoringType;
  skills: Array<{
    skillId: string;
    isRequired: boolean;
  }>;
  achievements: Array<{
    id: string;
  }>;
}

/**
 * Check if an evaluation meets the completion requirements for its template.
 * 
 * @param evaluationId - The evaluation to check
 * @returns Object containing completion status and details
 */
export async function checkEvaluationCompletion(evaluationId: string): Promise<{
  isComplete: boolean;
  passedCount: number;
  requiredCount: number;
  percentage: number;
  threshold: number;
  completionType: CompletionType;
}> {
  const evaluation = await db.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      skillRatings: {
        include: {
          skill: {
            select: { category: true },
          },
        },
      },
      template: {
        include: {
          skills: {
            select: {
              skillId: true,
              isRequired: true,
            },
          },
          achievements: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!evaluation || !evaluation.template) {
    return {
      isComplete: false,
      passedCount: 0,
      requiredCount: 0,
      percentage: 0,
      threshold: 0,
      completionType: "PERCENTAGE",
    };
  }

  const template = evaluation.template as TemplateData;
  const skillRatings = evaluation.skillRatings as EvaluationSkillData[];

  // Get the required skills from the template
  const requiredSkillIds = new Set(
    template.skills
      .filter((s) => s.isRequired)
      .map((s) => s.skillId)
  );

  // Count passed skills among required skills
  const passedSkills = skillRatings.filter(
    (sr) => sr.passed && requiredSkillIds.has(sr.skillId)
  );

  const passedCount = passedSkills.length;
  const requiredCount = requiredSkillIds.size;
  const percentage = requiredCount > 0 ? (passedCount / requiredCount) * 100 : 0;
  const threshold = Number(template.completionThreshold);

  let isComplete = false;

  switch (template.completionType) {
    case "PERCENTAGE":
      isComplete = percentage >= threshold;
      break;
    case "COUNT":
      isComplete = passedCount >= threshold;
      break;
    case "ALL":
      isComplete = passedCount === requiredCount;
      break;
  }

  return {
    isComplete,
    passedCount,
    requiredCount,
    percentage,
    threshold,
    completionType: template.completionType,
  };
}

/**
 * Calculate best results by category for an athlete's evaluations with a specific template.
 * 
 * @param athleteId - The athlete ID
 * @param templateId - The template ID
 * @returns Object mapping category names to best scores
 */
export async function calculateBestResultsByCategory(
  athleteId: string,
  templateId: string
): Promise<Record<string, number>> {
  // Get all evaluations for this athlete with this template
  const evaluations = await db.evaluation.findMany({
    where: {
      athleteId,
      templateId,
    },
    include: {
      skillRatings: {
        include: {
          skill: {
            select: { category: true },
          },
        },
      },
    },
  });

  const bestByCategory: Record<string, number> = {};

  for (const evaluation of evaluations) {
    for (const sr of evaluation.skillRatings) {
      const category = sr.skill.category;
      const score = sr.pointScore ?? (sr.passed ? 10 : 0);

      if (!bestByCategory[category] || score > bestByCategory[category]) {
        bestByCategory[category] = score;
      }
    }
  }

  return bestByCategory;
}

/**
 * Award an achievement to an athlete if not already earned.
 * 
 * @param athleteId - The athlete ID
 * @param achievementId - The achievement ID
 * @param evaluationId - The evaluation that triggered the achievement (optional)
 * @returns The created AthleteAchievement or null if already earned
 */
export async function awardAchievement(
  athleteId: string,
  achievementId: string,
  evaluationId?: string
): Promise<{ id: string; earnedAt: Date } | null> {
  // Check if already earned
  const existing = await db.athleteAchievement.findUnique({
    where: {
      athleteId_achievementId: {
        athleteId,
        achievementId,
      },
    },
  });

  if (existing) {
    return null; // Already earned
  }

  // Get achievement details to find the template
  const achievement = await db.achievement.findUnique({
    where: { id: achievementId },
    include: {
      template: true,
    },
  });

  if (!achievement) {
    throw new Error(`Achievement not found: ${achievementId}`);
  }

  // Calculate best results by category
  const bestResultsByCategory = await calculateBestResultsByCategory(
    athleteId,
    achievement.templateId
  );

  // Calculate overall score (average of category bests)
  const categoryScores = Object.values(bestResultsByCategory);
  const overallScore = categoryScores.length > 0
    ? categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length
    : 0;

  // Create the achievement record
  const athleteAchievement = await db.athleteAchievement.create({
    data: {
      athleteId,
      achievementId,
      evaluationId,
      bestResultsByCategory,
      overallScore: new Decimal(overallScore.toFixed(2)),
    },
  });

  return {
    id: athleteAchievement.id,
    earnedAt: athleteAchievement.earnedAt,
  };
}

/**
 * Check and award achievements for an evaluation if completion requirements are met.
 * This should be called after an evaluation is completed/updated.
 * 
 * @param evaluationId - The evaluation ID to check
 * @returns Array of newly awarded achievements
 */
export async function checkAndAwardAchievements(
  evaluationId: string
): Promise<Array<{ achievementId: string; achievementName: string }>> {
  const evaluation = await db.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      template: {
        include: {
          achievements: true,
        },
      },
    },
  });

  if (!evaluation || !evaluation.template) {
    return [];
  }

  const completionResult = await checkEvaluationCompletion(evaluationId);

  if (!completionResult.isComplete) {
    return [];
  }

  const awardedAchievements: Array<{ achievementId: string; achievementName: string }> = [];

  // Try to award each achievement associated with the template
  for (const achievement of evaluation.template.achievements) {
    const result = await awardAchievement(
      evaluation.athleteId,
      achievement.id,
      evaluationId
    );

    if (result) {
      awardedAchievements.push({
        achievementId: achievement.id,
        achievementName: achievement.name,
      });
    }
  }

  return awardedAchievements;
}

/**
 * Get athlete's progress toward achievements for a specific template.
 * 
 * @param athleteId - The athlete ID
 * @param templateId - The template ID
 * @returns Progress information including earned status and completion percentage
 */
export async function getAthleteAchievementProgress(
  athleteId: string,
  templateId: string
): Promise<{
  achievements: Array<{
    id: string;
    name: string;
    description: string | null;
    badgeImageUrl: string | null;
    earned: boolean;
    earnedAt: Date | null;
    progress: {
      passedCount: number;
      requiredCount: number;
      percentage: number;
    };
  }>;
}> {
  // Get template with achievements
  const template = await db.evaluationTemplate.findUnique({
    where: { id: templateId },
    include: {
      achievements: true,
      skills: {
        where: { isRequired: true },
        select: { skillId: true },
      },
    },
  });

  if (!template) {
    return { achievements: [] };
  }

  // Get athlete's earned achievements
  const earnedAchievements = await db.athleteAchievement.findMany({
    where: {
      athleteId,
      achievementId: { in: template.achievements.map((a) => a.id) },
    },
  });

  const earnedMap = new Map(
    earnedAchievements.map((ea) => [ea.achievementId, ea])
  );

  // Get latest evaluation for progress calculation
  const latestEvaluation = await db.evaluation.findFirst({
    where: {
      athleteId,
      templateId,
    },
    orderBy: { date: "desc" },
    include: {
      skillRatings: true,
    },
  });

  // Calculate current progress
  const requiredSkillIds = new Set(template.skills.map((s) => s.skillId));
  const passedCount = latestEvaluation
    ? latestEvaluation.skillRatings.filter(
        (sr) => sr.passed && requiredSkillIds.has(sr.skillId)
      ).length
    : 0;
  const requiredCount = requiredSkillIds.size;
  const percentage = requiredCount > 0 ? (passedCount / requiredCount) * 100 : 0;

  return {
    achievements: template.achievements.map((achievement) => {
      const earned = earnedMap.get(achievement.id);
      return {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        badgeImageUrl: achievement.badgeImageUrl,
        earned: !!earned,
        earnedAt: earned?.earnedAt ?? null,
        progress: {
          passedCount,
          requiredCount,
          percentage,
        },
      };
    }),
  };
}
