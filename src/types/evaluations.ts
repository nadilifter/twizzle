// Skills and Evaluations Types

export type SkillAttemptStatus = "NOT_ATTEMPTED" | "ATTEMPTED" | "SUCCEEDED";
export type EvaluationStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "PASS"
  | "RETRY"
  | "EXCELLENT"
  | "SATISFACTORY";
export type ScoringType = "PASS_FAIL" | "POINT_SCALE";
export type CompletionType = "PERCENTAGE" | "COUNT" | "ALL";

// ===== Levels =====

export interface Level {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  order: number;
  color: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== Skills =====

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: string | null;
  description: string | null;
  levelId: string | null;
  minAge: number | null;
  maxAge: number | null;
  videoUrl: string | null;
  imageUrl: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  skillLevel?: Level | null;
}

export interface CreateSkillPayload {
  name: string;
  category: string;
  level?: string;
  description?: string;
  levelId?: string;
  minAge?: number;
  maxAge?: number;
  videoUrl?: string;
  imageUrl?: string;
}

export interface UpdateSkillPayload {
  name?: string;
  category?: string;
  level?: string;
  description?: string;
  levelId?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
}

export interface SkillsListResponse {
  data: Skill[];
  grouped: Record<string, Skill[]>;
  total: number;
  limit: number;
  offset: number;
}

export interface SkillsQueryParams {
  search?: string;
  category?: string;
  level?: string;
  levelId?: string;
  minAge?: number;
  maxAge?: number;
  limit?: number;
  offset?: number;
}

// ===== Evaluation Templates =====

export interface EvaluationTemplateSkill {
  id: string;
  templateId: string;
  skillId: string;
  order: number;
  isRequired: boolean;
  skill: Skill;
}

export interface EvaluationTemplate {
  id: string;
  name: string;
  description: string | null;
  levelId: string | null;
  minAge: number | null;
  maxAge: number | null;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;

  // Auto-sync configuration
  autoSyncEnabled: boolean;
  autoSyncLevels: string[];
  autoSyncCategories: string[];

  // Scoring configuration
  scoringType: ScoringType;
  pointScaleMin: number;
  pointScaleMax: number;
  pointScalePassThreshold: number;

  // Completion requirements
  completionType: CompletionType;
  completionThreshold: number;

  // Level relation
  level?: Level | null;
}

export interface ProgramEvaluationTemplate {
  id: string;
  programId: string;
  templateId: string;
  isRequired: boolean;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  program?: {
    id: string;
    name: string;
  };
  template?: EvaluationTemplateWithSkills;
}

export interface Achievement {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  badgeImageUrl: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AchievementWithTemplate extends Achievement {
  template: {
    id: string;
    name: string;
    levelId: string | null;
    level?: Level | null;
    completionType: CompletionType;
    completionThreshold: number;
  };
  _count?: {
    athleteAchievements: number;
  };
}

export interface EvaluationTemplateWithSkills extends EvaluationTemplate {
  skills: EvaluationTemplateSkill[];
  programTemplates?: ProgramEvaluationTemplate[];
  achievements?: Achievement[];
  _count?: {
    evaluations: number;
  };
}

export interface CreateEvaluationTemplatePayload {
  name: string;
  description?: string;
  levelId?: string;
  minAge?: number;
  maxAge?: number;
  isActive?: boolean;

  // Auto-sync configuration
  autoSyncEnabled?: boolean;
  autoSyncLevels?: string[];
  autoSyncCategories?: string[];

  // Scoring configuration
  scoringType?: ScoringType;
  pointScaleMin?: number;
  pointScaleMax?: number;
  pointScalePassThreshold?: number;

  // Completion requirements
  completionType?: CompletionType;
  completionThreshold?: number;

  // Skills (optional if auto-sync enabled)
  skillIds?: string[];
}

export interface UpdateEvaluationTemplatePayload {
  name?: string;
  description?: string;
  levelId?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
  isActive?: boolean;

  // Auto-sync configuration
  autoSyncEnabled?: boolean;
  autoSyncLevels?: string[];
  autoSyncCategories?: string[];

  // Scoring configuration
  scoringType?: ScoringType;
  pointScaleMin?: number;
  pointScaleMax?: number;
  pointScalePassThreshold?: number;

  // Completion requirements
  completionType?: CompletionType;
  completionThreshold?: number;

  skillIds?: string[];
}

export interface EvaluationTemplatesListResponse {
  data: EvaluationTemplateWithSkills[];
  total: number;
  limit: number;
  offset: number;
}

// ===== Evaluations =====

export interface EvaluationSkillRating {
  id: string;
  evaluationId: string;
  skillId: string;
  rating: number | null; // Legacy
  pointScore: number | null; // For POINT_SCALE
  attemptStatus: SkillAttemptStatus;
  passed: boolean;
  comment: string | null;
  skill: Skill;
}

export interface Evaluation {
  id: string;
  athleteId: string;
  coachId: string;
  templateId: string | null;
  programId: string | null;
  levelId: string | null;
  date: string;
  overallScore: number;
  status: EvaluationStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationWithRelations extends Evaluation {
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    level: string;
    avatar: string | null;
  };
  coach: {
    id: string;
    name: string;
    avatar: string | null;
  };
  template: EvaluationTemplate | null;
  program?: {
    id: string;
    name: string;
    level?: string;
  } | null;
  level?: Level | null;
  skillRatings: EvaluationSkillRating[];
  athleteAchievements?: AthleteAchievement[];
  newAchievements?: { achievementId: string; achievementName: string }[];
}

export interface CreateEvaluationPayload {
  athleteId: string;
  templateId?: string;
  programId?: string;
  date: string;
  levelId?: string;
  overallScore?: number;
  status?: EvaluationStatus;
  notes?: string;
  skillRatings?: {
    skillId: string;
    rating?: number;
    pointScore?: number;
    attemptStatus?: SkillAttemptStatus;
    passed?: boolean;
    comment?: string;
  }[];
}

export interface UpdateEvaluationPayload {
  date?: string;
  levelId?: string | null;
  overallScore?: number;
  status?: EvaluationStatus;
  notes?: string;
  skillRatings?: {
    skillId: string;
    rating?: number;
    pointScore?: number;
    attemptStatus?: SkillAttemptStatus;
    passed?: boolean;
    comment?: string;
  }[];
}

export interface EvaluationsListResponse {
  data: EvaluationWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

// ===== Athlete Skill Progress =====

export interface AthleteSkillProgress {
  id: string;
  athleteId: string;
  skillId: string;
  bestStatus: SkillAttemptStatus;
  firstAttemptedAt: string | null;
  firstSucceededAt: string | null;
  attemptCount: number;
  successCount: number;
  lastEvaluatedAt: string;
  lastEvaluationId: string | null;
  createdAt: string;
  updatedAt: string;
  skill: Skill;
}

export interface AthleteSkillProgressResponse {
  data: AthleteSkillProgress[];
  summary: {
    total: number;
    notAttempted: number;
    attempted: number;
    succeeded: number;
  };
  byCategory: Record<
    string,
    {
      total: number;
      notAttempted: number;
      attempted: number;
      succeeded: number;
    }
  >;
}

// ===== Achievements =====

export interface AthleteAchievement {
  id: string;
  athleteId: string;
  achievementId: string;
  evaluationId: string | null;
  earnedAt: string;
  bestResultsByCategory: Record<string, number> | null;
  overallScore: number | null;
  achievement?: Achievement;
  evaluation?: {
    id: string;
    date: string;
    overallScore: number;
  };
}

export interface AthleteAchievementWithDetails extends AthleteAchievement {
  achievement: AchievementWithTemplate;
  athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    level: string;
    avatar: string | null;
  };
}

export interface CreateAchievementPayload {
  templateId: string;
  name: string;
  description?: string;
  badgeImageUrl?: string;
}

export interface UpdateAchievementPayload {
  name?: string;
  description?: string | null;
  badgeImageUrl?: string | null;
}

export interface AchievementsListResponse {
  data: AchievementWithTemplate[];
  total: number;
  limit: number;
  offset: number;
}

export interface AthleteAchievementsResponse {
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    level: string;
    avatar: string | null;
  };
  achievements: Array<{
    id: string;
    name: string;
    description: string | null;
    badgeImageUrl: string | null;
    templateId: string;
    templateName: string;
    templateLevelId: string | null;
    templateLevel: Level | null;
    completionType: CompletionType;
    completionThreshold: number;
    earned: boolean;
    earnedAt: string | null;
    bestResultsByCategory: Record<string, number> | null;
    overallScore: number | null;
    progress: {
      passedCount: number;
      requiredCount: number;
      percentage: number;
    } | null;
  }>;
  summary: {
    total: number;
    earned: number;
    inProgress: number;
  };
}

// ===== Program Evaluation Templates =====

export interface AssignTemplatePayload {
  templateId: string;
  isRequired?: boolean;
  dueDate?: string;
}

export interface UpdateAssignmentPayload {
  isRequired?: boolean;
  dueDate?: string | null;
}

export interface ProgramTemplatesResponse {
  programId: string;
  programName: string;
  templates: ProgramEvaluationTemplate[];
}

export interface GenerateEvaluationsPayload {
  templateId: string;
  athleteIds?: string[];
  date?: string;
}

export interface GenerateEvaluationsResponse {
  created: number;
  skipped: number;
  evaluations?: Array<{
    id: string;
    athleteId: string;
    athlete: {
      id: string;
      firstName: string;
      lastName: string;
      level: string;
    };
  }>;
  message?: string;
}

// ===== Template Sync =====

export interface SyncResult {
  templateId: string;
  added: number;
  removed: number;
  total: number;
}

export interface SyncPreviewResponse {
  autoSyncEnabled: boolean;
  autoSyncLevels: string[];
  autoSyncCategories: string[];
  preview: {
    totalMatching: number;
    currentCount: number;
    toAdd: number;
    toRemove: number;
    matchingSkills: Array<{
      id: string;
      name: string;
      category: string;
      levelId: string | null;
    }>;
  };
}
