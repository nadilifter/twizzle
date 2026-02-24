// Re-export all types for convenient imports
export * from "./athletes";
export * from "./staff";
export * from "./programs";
export * from "./evaluations";
export * from "./medical";

// Resolve ambiguous re-exports: when multiple modules export the same name,
// explicitly choose which module's version to use.
export type { PaymentMethod } from "./athletes";
export type { Evaluation, Skill } from "./evaluations";
export type { AthleteMedicalSummary } from "./medical";
