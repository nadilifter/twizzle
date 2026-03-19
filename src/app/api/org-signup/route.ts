import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, getAuthSession } from "@/lib/auth"
import { z } from "zod"
import { passwordSchema } from "@/lib/password"
import { isSubdomainReserved } from "@/lib/reserved-domains"
import { containsProfanity } from "@/lib/profanity"
import { registerAllowedOrigin } from "@/lib/adyen-platform"

const MAX_NAME_LENGTH = 255
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

function isValidPostalCode(value: string, country: string): boolean {
  const trimmed = value.trim().replace(/\s/g, "")
  if (!trimmed) return false
  if (country === "US") return /^\d{5}(-\d{4})?$/.test(trimmed)
  if (country === "CA") return /^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/.test(trimmed)
  return false
}

const signupSchema = z.object({
  // Existing account mode
  useExistingAccount: z.boolean().optional(),

  // User account (required only when creating a new account)
  name: z.string()
    .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or less`)
    .optional(),
  email: z.string().email("Invalid email address").optional(),
  password: passwordSchema.optional(),

  // Organization
  orgName: z.string().min(1, "Organization name is required"),
  orgEmail: z.string().email("Invalid organization email"),
  phone: z.string().min(1, "Phone is required"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  stateProvince: z.string().min(1, "State / Province is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.enum(["US", "CA"], { message: "Country must be United States or Canada" }),

  // Website
  subdomain: z.string()
    .min(3, "Subdomain must be at least 3 characters")
    .max(63, "Subdomain must be at most 63 characters")
    .regex(/^[a-z0-9-]+$/, "Subdomain can only contain lowercase letters, numbers, and hyphens")
    .refine((s) => !s.startsWith("-") && !s.endsWith("-"), "Subdomain cannot start or end with a hyphen"),

  // Branding (optional)
  primaryColor: z.string().regex(HEX_COLOR_REGEX, "Primary color must be a valid hex (e.g. #000000)").optional(),
  secondaryColor: z.string().regex(HEX_COLOR_REGEX, "Secondary color must be a valid hex (e.g. #ffffff)").optional(),

  // Plan
  planId: z.string().min(1, "Please select a plan"),
  
  // Sports (optional)
  sportIds: z.array(z.string()).optional(),

  // Adyen (optional - for paid plans)
  adyenShopperReference: z.string().optional(),
}).refine(
  (data) => isValidPostalCode(data.postalCode, data.country),
  { message: "Postal code must be a valid US ZIP or Canadian postal code", path: ["postalCode"] }
).superRefine((data, ctx) => {
  if (!data.useExistingAccount) {
    if (!data.name || data.name.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name is required", path: ["name"] })
    }
    if (!data.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email is required", path: ["email"] })
    }
    if (!data.password) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Password is required", path: ["password"] })
    }
  }
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = signupSchema.parse(body)

    if (containsProfanity(validatedData.orgName)) {
      return NextResponse.json(
        { error: "Organization name contains inappropriate language" },
        { status: 400 }
      )
    }
    if (containsProfanity(validatedData.subdomain)) {
      return NextResponse.json(
        { error: "Subdomain contains inappropriate language" },
        { status: 400 }
      )
    }

    const reservedCheck = await isSubdomainReserved(validatedData.subdomain.toLowerCase())
    if (reservedCheck.reserved) {
      return NextResponse.json(
        { error: reservedCheck.reason || "This subdomain is reserved and cannot be used" },
        { status: 400 }
      )
    }

    // Resolve the user: either from existing session or create a new one
    let userId: string

    if (validatedData.useExistingAccount) {
      const session = await getAuthSession()
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "You must be logged in to use your existing account" },
          { status: 401 }
        )
      }
      userId = session.user.id
    } else {
      // New account flow: check for duplicate email
      const existingUser = await db.user.findUnique({
        where: { email: validatedData.email! },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        )
      }
    }

    // Check if subdomain is already taken
    const existingSubdomain = await db.websiteConfig.findUnique({
      where: { subdomain: validatedData.subdomain },
    })

    if (existingSubdomain) {
      return NextResponse.json(
        { error: "This subdomain is already taken" },
        { status: 400 }
      )
    }

    // Check if organization slug is taken
    const orgSlug = validatedData.subdomain
    const existingOrg = await db.organization.findUnique({
      where: { slug: orgSlug },
    })

    if (existingOrg) {
      return NextResponse.json(
        { error: "This organization identifier is already taken" },
        { status: 400 }
      )
    }

    // Verify the plan exists and is active/public
    const plan = await db.subscriptionPlan.findUnique({
      where: { id: validatedData.planId },
    })

    if (!plan || !plan.isActive || !plan.isPublic) {
      return NextResponse.json(
        { error: "Invalid subscription plan" },
        { status: 400 }
      )
    }

    const now = new Date()
    const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const result = await db.$transaction(async (tx) => {
      // 1. Create the organization
      const organization = await tx.organization.create({
        data: {
          name: validatedData.orgName,
          slug: orgSlug,
          email: validatedData.orgEmail,
          phone: validatedData.phone || null,
          street: validatedData.street || null,
          city: validatedData.city || null,
          stateProvince: validatedData.stateProvince || null,
          postalCode: validatedData.postalCode || null,
          country: validatedData.country || null,
        },
      })

      // 2. Resolve the user ID: reuse existing or create new
      let resolvedUserId: string
      if (validatedData.useExistingAccount) {
        resolvedUserId = userId
      } else {
        const passwordHash = await hashPassword(validatedData.password!)
        const user = await tx.user.create({
          data: {
            email: validatedData.email!,
            name: validatedData.name!,
            passwordHash,
            role: "ADMIN",
            status: "ACTIVE",
          },
        })
        resolvedUserId = user.id
      }

      // 3. Create the organization member relationship
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: resolvedUserId,
          role: "ADMIN",
          status: "ACTIVE",
        },
      })

      // 4. Create the website config
      await tx.websiteConfig.create({
        data: {
          organizationId: organization.id,
          subdomain: validatedData.subdomain,
          primaryColor: validatedData.primaryColor || "#000000",
          secondaryColor: validatedData.secondaryColor || "#ffffff",
          isPublished: true,
          heroHeadline: "Welcome to",
          heroSubheadline: "Your organization's home on Uplifter",
        },
      })

      // 5. Create the subscription (trial)
      const adyenShopperRef = validatedData.adyenShopperReference 
        ? `org-${organization.id}`
        : null
      
      await tx.organizationSubscription.create({
        data: {
          organizationId: organization.id,
          planId: plan.id,
          status: "TRIALING",
          billingCycle: "MONTHLY",
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          trialEndsAt: trialEndsAt,
          adyenShopperReference: adyenShopperRef,
        },
      })

      // 6. Create the default facility with organization's address
      await tx.facility.create({
        data: {
          organizationId: organization.id,
          name: validatedData.orgName,
          street: validatedData.street || null,
          city: validatedData.city || null,
          stateProvince: validatedData.stateProvince || null,
          postalCode: validatedData.postalCode || null,
          country: validatedData.country || null,
          phone: validatedData.phone || null,
          email: validatedData.orgEmail || null,
          isDefault: true,
          status: "ACTIVE",
        },
      })

      // 7. Associate selected sports (if any)
      if (validatedData.sportIds && validatedData.sportIds.length > 0) {
        await Promise.all(
          validatedData.sportIds.map((sportId) =>
            tx.organizationSport.create({
              data: {
                organizationId: organization.id,
                sportId,
              },
            })
          )
        )
      }

      return { organization, userId: resolvedUserId }
    })

    // If a payment method was collected during signup, claim any tokens
    // that the recurring webhook may have already created under the temporary reference
    if (validatedData.adyenShopperReference) {
      const permanentRef = `org-${result.organization.id}`
      try {
        const orphanedMethods = await db.organizationPaymentMethod.findMany({
          where: { shopperReference: validatedData.adyenShopperReference },
        })

        for (const method of orphanedMethods) {
          await db.organizationPaymentMethod.update({
            where: { id: method.id },
            data: {
              organizationId: result.organization.id,
              shopperReference: permanentRef,
            },
          })
        }

        if (orphanedMethods.length > 0) {
          await db.organizationSubscription.updateMany({
            where: { organizationId: result.organization.id },
            data: { adyenRecurringDetailRef: orphanedMethods[0].storedPaymentMethodId },
          })
        }
      } catch (err) {
        console.error("Failed to claim orphaned payment methods:", err)
      }
    }

    void registerAllowedOrigin(validatedData.subdomain)

    return NextResponse.json({
      success: true,
      organizationId: result.organization.id,
      userId: result.userId,
      subdomain: validatedData.subdomain,
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "Failed to create organization. Please try again." },
      { status: 500 }
    )
  }
}
