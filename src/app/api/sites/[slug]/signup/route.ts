import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, isUplifterEmail } from "@/lib/auth";
import { verifyVerifiedToken } from "@/lib/mfa";
import { z } from "zod";
import { passwordSchema } from "@/lib/password";

const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
    verificationToken: z.string().min(1, "Email verification is required"),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms and conditions" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * POST /api/sites/[slug]/signup
 *
 * Register a new user via the marketing site.
 * Creates a user with PARENT role associated with the subdomain's organization.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    // Validate input
    const validatedData = signupSchema.parse(body);
    const email = validatedData.email.toLowerCase().trim();

    // Verify the email was confirmed via the verification flow
    const proofResult = verifyVerifiedToken(validatedData.verificationToken, "SIGNUP_VERIFICATION");
    if (!proofResult || proofResult.email !== email) {
      return NextResponse.json(
        {
          error: "Email verification is invalid or expired. Please verify your email again.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    // Reject Uplifter staff emails - they must use Microsoft OAuth
    if (isUplifterEmail(email)) {
      return NextResponse.json(
        {
          error: "Uplifter staff should sign in with Microsoft instead.",
          code: "UPLIFTER_EMAIL",
        },
        { status: 400 }
      );
    }

    // Get organization from subdomain
    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      include: { organization: true },
    });

    if (!config || !config.isPublished) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const organizationId = config.organizationId;
    const organizationName = config.organization.name;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "An account with this email already exists. Please log in instead.",
          code: "USER_EXISTS",
        },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(validatedData.password);

    // Create user and organization member in transaction
    const user = await db.$transaction(async (tx) => {
      // Create user with PARENT role
      const newUser = await tx.user.create({
        data: {
          email,
          name: validatedData.name,
          passwordHash,
          role: "PARENT",
          status: "ACTIVE",
          termsAcceptedAt: new Date(),
        },
      });

      // Create organization member relationship
      await tx.organizationMember.create({
        data: {
          organizationId,
          userId: newUser.id,
          role: "PARENT",
          status: "ACTIVE",
        },
      });

      return newUser;
    });

    return NextResponse.json({
      success: true,
      message: `Welcome to ${organizationName}!`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organizationId,
      organizationName,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Marketing site signup error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
