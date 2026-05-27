import { create } from "zustand";

export interface Rotation {
  id: string | number;
  name: string;
  description: string;
  skills: string[];
  media?: string[];
}

export interface LessonPlan {
  id: string;
  name: string;
  program: string;
  date: string;
  author: string;
  status: "Active" | "Draft" | "Archived";
  theme: string;
  notes?: string;
  rotations: Rotation[];
}

interface LessonPlanState {
  plans: LessonPlan[];
  addPlan: (plan: LessonPlan) => void;
  updatePlan: (id: string, updates: Partial<LessonPlan>) => void;
  deletePlan: (id: string) => void;
  duplicatePlan: (id: string) => void;
}

const initialPlans: LessonPlan[] = [
  {
    id: "1",
    name: "Week 42 - Edge Fundamentals",
    program: "CanSkate - Stage 2",
    date: "2024-10-14",
    author: "Coach Sarah",
    status: "Active",
    theme: "Edge Development Week",
    rotations: [],
  },
  {
    id: "2",
    name: "Week 42 - Jump Technique",
    program: "STARSkate - STAR 4",
    date: "2024-10-14",
    author: "Coach Mike",
    status: "Active",
    theme: "Power & Rotation",
    rotations: [],
  },
  {
    id: "3",
    name: "Week 43 - Halloween Showcase Prep",
    program: "Pre-CanSkate",
    date: "2024-10-21",
    author: "Coach Emily",
    status: "Draft",
    theme: "Performance Skills",
    rotations: [],
  },
  {
    id: "4",
    name: "Week 41 - Spin Centering",
    program: "STARSkate - STAR 2",
    date: "2024-10-07",
    author: "Coach Sarah",
    status: "Archived",
    theme: "Balance and Control",
    rotations: [],
  },
];

export const useLessonPlanStore = create<LessonPlanState>((set) => ({
  plans: initialPlans,
  addPlan: (plan) => set((state) => ({ plans: [plan, ...state.plans] })),
  updatePlan: (id, updates) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  deletePlan: (id) => set((state) => ({ plans: state.plans.filter((p) => p.id !== id) })),
  duplicatePlan: (id) =>
    set((state) => {
      const planToDup = state.plans.find((p) => p.id === id);
      if (!planToDup) return state;
      const newPlan: LessonPlan = {
        ...planToDup,
        id: Math.random().toString(36).substr(2, 9),
        name: `${planToDup.name} (Copy)`,
        status: "Draft",
      };
      return { plans: [newPlan, ...state.plans] };
    }),
}));
