import { z } from "zod";
import { passwordSchema } from "@/lib/password";
import { isValidPhoneNumber } from "libphonenumber-js";

const MAX_NAME_LENGTH = 255;
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

function isValidPostalCode(value: string, country: string): boolean {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return false;
  if (country === "US") return /^\d{5}(-\d{4})?$/.test(trimmed);
  if (country === "CA") return /^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/.test(trimmed);
  return false;
}

export const signupSchema = z
  .object({
    useExistingAccount: z.boolean().optional(),

    name: z
      .string()
      .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or less`)
      .optional(),
    email: z.string().email("Invalid email address").optional(),
    password: passwordSchema.optional(),

    orgName: z.string().min(1, "Organization name is required"),
    orgEmail: z.string().email("Invalid organization email"),
    phone: z
      .string()
      .min(1, "Phone is required")
      .refine(isValidPhoneNumber, "Please enter a valid phone number"),
    street: z.string().min(1, "Street address is required"),
    city: z.string().min(1, "City is required"),
    stateProvince: z.string().min(1, "State / Province is required"),
    postalCode: z.string().min(1, "Postal code is required"),
    country: z.enum(["US", "CA"], { message: "Country must be United States or Canada" }),

    subdomain: z
      .string()
      .min(3, "Subdomain must be at least 3 characters")
      .max(63, "Subdomain must be at most 63 characters")
      .regex(/^[a-z0-9-]+$/, "Subdomain can only contain lowercase letters, numbers, and hyphens")
      .refine(
        (s) => !s.startsWith("-") && !s.endsWith("-"),
        "Subdomain cannot start or end with a hyphen"
      ),

    primaryColor: z
      .string()
      .regex(HEX_COLOR_REGEX, "Primary color must be a valid hex (e.g. #000000)")
      .optional(),
    secondaryColor: z
      .string()
      .regex(HEX_COLOR_REGEX, "Secondary color must be a valid hex (e.g. #ffffff)")
      .optional(),

    planId: z.string().min(1, "Please select a plan"),

    sportIds: z.array(z.string()).optional(),

    adyenShopperReference: z
      .string()
      .min(3, "Shopper reference must be at least 3 characters")
      .max(256)
      .refine((s) => s.startsWith("signup-"), "Invalid payment session reference")
      .optional(),

    runCronAfterCreation: z.boolean().optional(),
  })
  .refine((data) => isValidPostalCode(data.postalCode, data.country), {
    message: "Postal code must be a valid US ZIP or Canadian postal code",
    path: ["postalCode"],
  })
  .superRefine((data, ctx) => {
    if (!data.useExistingAccount) {
      if (!data.name || data.name.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name is required", path: ["name"] });
      }
      if (!data.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Email is required",
          path: ["email"],
        });
      }
      if (!data.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password is required",
          path: ["password"],
        });
      }
    }
  });
