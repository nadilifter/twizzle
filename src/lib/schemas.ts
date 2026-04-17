import { z } from "zod";

/** Accepts full URLs (https://...) and relative paths (/uploads/...) */
export const imageUrlSchema = z
  .string()
  .min(1)
  .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Invalid image URL");
