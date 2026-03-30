import { z } from "zod";

/**
 * PCI DSS v4.0 compliant password policy.
 *
 * Requirements (§8.3.6):
 *  - Minimum 12 characters
 *  - At least one uppercase letter
 *  - At least one lowercase letter
 *  - At least one digit
 *  - At least one special character
 */

export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_RULES = {
  minLength: PASSWORD_MIN_LENGTH,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /\d/,
  special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
} as const;

export const PASSWORD_MESSAGES = {
  minLength: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  uppercase: "Password must include at least one uppercase letter",
  lowercase: "Password must include at least one lowercase letter",
  digit: "Password must include at least one number",
  special: "Password must include at least one special character",
  mismatch: "Passwords do not match",
} as const;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_MESSAGES.minLength)
  .regex(PASSWORD_RULES.uppercase, PASSWORD_MESSAGES.uppercase)
  .regex(PASSWORD_RULES.lowercase, PASSWORD_MESSAGES.lowercase)
  .regex(PASSWORD_RULES.digit, PASSWORD_MESSAGES.digit)
  .regex(PASSWORD_RULES.special, PASSWORD_MESSAGES.special);

/**
 * Client-side validation helper that returns the first failing rule message,
 * or null when the password is valid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_MESSAGES.minLength;
  if (!PASSWORD_RULES.uppercase.test(password)) return PASSWORD_MESSAGES.uppercase;
  if (!PASSWORD_RULES.lowercase.test(password)) return PASSWORD_MESSAGES.lowercase;
  if (!PASSWORD_RULES.digit.test(password)) return PASSWORD_MESSAGES.digit;
  if (!PASSWORD_RULES.special.test(password)) return PASSWORD_MESSAGES.special;
  return null;
}

export const PASSWORD_PLACEHOLDER = `At least ${PASSWORD_MIN_LENGTH} characters, with upper/lowercase, number & symbol`;
