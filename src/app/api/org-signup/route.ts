import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, getAuthSession } from "@/lib/auth";
import { z } from "zod";
import { isSubdomainReserved } from "@/lib/reserved-domains";
import { containsProfanity } from "@/lib/profanity";
import { registerAllowedOrigin } from "@/lib/adyen-platform";
import { createDefaultGLCodes } from "@/lib/gl-code-defaults";
import { getDefaultTaxRate } from "@/lib/tax-utils";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { geocodeAddress } from "@/lib/geocode";
import { getStoredPaymentMethods, isAdyenConfigured } from "@/lib/adyen";
import { signupSchema } from "./signup-schema";

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(request, "org-signup", RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const validatedData = signupSchema.parse(body);

    if (containsProfanity(validatedData.orgName)) {
      return NextResponse.json(
        { error: "Organization name contains inappropriate language" },
        { status: 400 }
      );
    }
    if (containsProfanity(validatedData.subdomain)) {
      return NextResponse.json(
        { error: "Subdomain contains inappropriate language" },
        { status: 400 }
      );
    }

    // Check if organization name is already taken (case-insensitive)
    const existingOrgName = await db.organization.findFirst({
      where: {
        name: { equals: validatedData.orgName.trim(), mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existingOrgName) {
      return NextResponse.json(
        { error: "An organization with this name already exists" },
        { status: 400 }
      );
    }

    const reservedCheck = await isSubdomainReserved(validatedData.subdomain.toLowerCase());
    if (reservedCheck.reserved) {
      return NextResponse.json(
        { error: reservedCheck.reason || "This subdomain is reserved and cannot be used" },
        { status: 400 }
      );
    }

    // Resolve the user: either from existing session or create a new one
    let userId: string;

    if (validatedData.useExistingAccount) {
      const session = await getAuthSession();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "You must be logged in to use your existing account" },
          { status: 401 }
        );
      }
      userId = session.user.id;
    } else {
      // New account flow: check for duplicate email
      const existingUser = await db.user.findUnique({
        where: { email: validatedData.email! },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Check if subdomain is already taken
    const existingSubdomain = await db.websiteConfig.findUnique({
      where: { subdomain: validatedData.subdomain },
    });

    if (existingSubdomain) {
      return NextResponse.json({ error: "This subdomain is already taken" }, { status: 400 });
    }

    // Check if organization slug is taken
    const orgSlug = validatedData.subdomain;
    const existingOrg = await db.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "This organization identifier is already taken" },
        { status: 400 }
      );
    }

    // Verify the plan exists and is active/public
    const plan = await db.subscriptionPlan.findUnique({
      where: { id: validatedData.planId },
    });

    if (!plan || !plan.isActive || !plan.isPublic) {
      return NextResponse.json({ error: "Invalid subscription plan" }, { status: 400 });
    }

    const isFreePlan = plan.monthlyPrice.toNumber() === 0;

    if (!isFreePlan && !validatedData.adyenShopperReference) {
      return NextResponse.json(
        { error: "Payment method required for paid plans" },
        { status: 400 }
      );
    }

    /** Populated for paid plans after Adyen confirms stored payment methods exist (same ref as tokenization). */
    let paidPlanStoredMethods: Awaited<ReturnType<typeof getStoredPaymentMethods>> = [];

    if (!isFreePlan) {
      if (!isAdyenConfigured()) {
        return NextResponse.json(
          {
            error:
              "Payment processing is not configured. Please contact support or add Adyen credentials to your environment.",
          },
          { status: 503 }
        );
      }

      const ref = validatedData.adyenShopperReference!;
      let methods = await getStoredPaymentMethods(ref);
      if (methods.length === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        methods = await getStoredPaymentMethods(ref);
      }
      if (methods.length === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        methods = await getStoredPaymentMethods(ref);
      }
      if (methods.length === 0) {
        return NextResponse.json(
          { error: "No valid payment method found. Please try again." },
          { status: 400 }
        );
      }
      paidPlanStoredMethods = methods;
    }

    const now = new Date();
    const trialEndsAt = isFreePlan ? null : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const facilityCoords = await geocodeAddress({
      street: validatedData.street,
      city: validatedData.city,
      stateProvince: validatedData.stateProvince,
      postalCode: validatedData.postalCode,
      country: validatedData.country,
    });

    const result = await db.$transaction(async (tx) => {
      // 1. Create the organization
      const defaultTaxRate = getDefaultTaxRate(validatedData.stateProvince, validatedData.country);
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
          taxRate: defaultTaxRate,
          taxEnabled: defaultTaxRate > 0,
        },
      });

      // 2. Resolve the user ID: reuse existing or create new
      let resolvedUserId: string;
      if (validatedData.useExistingAccount) {
        resolvedUserId = userId;
      } else {
        const passwordHash = await hashPassword(validatedData.password!);
        const user = await tx.user.create({
          data: {
            email: validatedData.email!,
            name: validatedData.name!,
            passwordHash,
            role: "ADMIN",
            status: "ACTIVE",
          },
        });
        resolvedUserId = user.id;
      }

      // 3. Create the organization member relationship
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: resolvedUserId,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

      // 4. Create the website config
      await tx.websiteConfig.create({
        data: {
          organizationId: organization.id,
          subdomain: validatedData.subdomain,
          primaryColor: validatedData.primaryColor || "#000000",
          secondaryColor: validatedData.secondaryColor || "#ffffff",
          isPublished: false,
          heroHeadline: "Welcome to",
          heroSubheadline: "Your organization's home on Uplifter",
        },
      });

      // 5. Create the subscription (Adyen shopper ref must match tokenization — do not substitute org-${id})
      const adyenShopperRef = isFreePlan ? null : (validatedData.adyenShopperReference ?? null);

      await tx.organizationSubscription.create({
        data: {
          organizationId: organization.id,
          planId: plan.id,
          status: isFreePlan ? "ACTIVE" : "TRIALING",
          billingCycle: "MONTHLY",
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt ?? now,
          trialEndsAt: trialEndsAt,
          adyenShopperReference: adyenShopperRef,
        },
      });

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
          latitude: facilityCoords?.latitude ?? null,
          longitude: facilityCoords?.longitude ?? null,
          phone: validatedData.phone || null,
          email: validatedData.orgEmail || null,
          isDefault: true,
          status: "ACTIVE",
        },
      });

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
        );
      }

      // 8. Create default GL codes for the organization
      await createDefaultGLCodes(organization.id, tx);

      return { organization, userId: resolvedUserId };
    });

    // Link payment methods to the new org. Shopper reference must stay the same as Adyen's
    // tokenization ref (signup-...). (1) Claim DB rows the webhook created before the org existed,
    // or (2) create rows from preflight Adyen data (already verified server-side).
    if (!isFreePlan && validatedData.adyenShopperReference) {
      const shopperRef = validatedData.adyenShopperReference;
      let methodLinked = false;

      try {
        const orphanedMethods = await db.organizationPaymentMethod.findMany({
          where: { shopperReference: shopperRef },
        });

        for (const method of orphanedMethods) {
          await db.organizationPaymentMethod.update({
            where: { id: method.id },
            data: {
              organizationId: result.organization.id,
            },
          });
        }

        if (orphanedMethods.length > 0) {
          await db.organizationSubscription.updateMany({
            where: { organizationId: result.organization.id },
            data: { adyenRecurringDetailRef: orphanedMethods[0].storedPaymentMethodId },
          });
          methodLinked = true;
        }
      } catch (err) {
        console.error("Failed to claim orphaned payment methods:", err);
      }

      if (!methodLinked) {
        try {
          for (const method of paidPlanStoredMethods) {
            try {
              await db.organizationPaymentMethod.create({
                data: {
                  organizationId: result.organization.id,
                  storedPaymentMethodId: method.id,
                  shopperReference: shopperRef,
                  type: method.type,
                  brand: method.brand,
                  lastFour: method.lastFour || "****",
                  expiryMonth: method.expiryMonth,
                  expiryYear: method.expiryYear,
                  holderName: method.holderName,
                  isDefault: paidPlanStoredMethods.indexOf(method) === 0,
                  isActive: true,
                },
              });
            } catch {
              // Unique constraint violation = webhook created it concurrently
            }
          }

          if (paidPlanStoredMethods.length > 0) {
            await db.organizationSubscription.updateMany({
              where: { organizationId: result.organization.id },
              data: { adyenRecurringDetailRef: paidPlanStoredMethods[0].id },
            });
          }
        } catch (err) {
          console.error("Failed to sync payment methods from Adyen:", err);
        }
      }
    }

    void registerAllowedOrigin(validatedData.subdomain);

    return NextResponse.json(
      {
        success: true,
        organizationId: result.organization.id,
        userId: result.userId,
        subdomain: validatedData.subdomain,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create organization. Please try again." },
      { status: 500 }
    );
  }
}
