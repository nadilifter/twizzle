// Skills and Evaluations Types

export type SkillDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type SkillAttemptStatus = "NOT_ATTEMPTED" | "ATTEMPTED" | "SUCCEEDED";
export type EvaluationStatus = "PENDING" | "IN_PROGRESS" | "PASS" | "RETRY" | "EXCELLENT" | "SATISFACTORY";

// ===== Skills =====

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: string | null;
  description: string | null;
  difficultyLevel: SkillDifficulty;
  minAge: number | null;
  maxAge: number | null;
  videoUrl: string | null;
  imageUrl: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkillPayload {
  name: string;
  category: string;
  level?: string;
  description?: string;
  difficultyLevel?: SkillDifficulty;
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
  difficultyLevel?: SkillDifficulty;
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
  difficultyLevel?: SkillDifficulty;
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
  difficultyLevel: SkillDifficulty;
  minAge: number | null;
  maxAge: number | null;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationTemplateWithSkills extends EvaluationTemplate {
  skills: EvaluationTemplateSkill[];
  _count?: {
    evaluations: number;
  };
}

export interface CreateEvaluationTemplatePayload {
  name: string;
  description?: string;
  difficultyLevel?: SkillDifficulty;
  minAge?: number;
  maxAge?: number;
  isActive?: boolean;
  skillIds: string[]; // Array of skill IDs to include
}

export interface UpdateEvaluationTemplatePayload {
  name?: string;
  description?: string;
  difficultyLevel?: SkillDifficulty;
  minAge?: number | null;
  maxAge?: number | null;
  isActive?: boolean;
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
  rating: number | null;
  attemptStatus: SkillAttemptStatus;
  comment: string | null;
  skill: Skill;
}

export interface Evaluation {
  id: string;
  athleteId: string;
  coachId: string;
  templateId: string | null;
  date: string;
  level: string;
  overallScore: number;
  status: EvaluationStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationWithRelations extends Evaluation {
  athlete: {
    id: string;
    name: string;
    level: string;
    avatar: string | null;
  };
  coach: {
    id: string;
    name: string;
    avatar: string | null;
  };
  template: EvaluationTemplate | null;
  skillRatings: EvaluationSkillRating[];
}

export interface CreateEvaluationPayload {
  athleteId: string;
  templateId?: string;
  date: string;
  level?: string;
  notes?: string;
  skillRatings?: {
    skillId: string;
    rating?: number;
    attemptStatus?: SkillAttemptStatus;
    comment?: string;
  }[];
}

export interface UpdateEvaluationPayload {
  date?: string;
  level?: string;
  overallScore?: number;
  status?: EvaluationStatus;
  notes?: string;
  skillRatings?: {
    skillId: string;
    rating?: number;
    attemptStatus?: SkillAttemptStatus;
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
  byCategory: Record<string, {
    total: number;
    notAttempted: number;
    attempted: number;
    succeeded: number;
  }>;
}
