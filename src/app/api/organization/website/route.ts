import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const websiteConfigSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  logo: z.string().optional().nullable(),
  favicon: z.string().optional().nullable(),
  heroImage: z.string().optional().nullable(),
  heroHeadline: z.string().optional().nullable(),
  heroSubheadline: z.string().optional().nullable(),
  heroText: z.string().optional().nullable(),
  heroAgeRange: z.string().optional().nullable(),
  heroProgramPeriods: z.string().optional().nullable(),
  heroLocation: z.string().optional().nullable(),
  showCalendar: z.boolean().optional(),
  showRegistration: z.boolean().optional(),
  showContact: z.boolean().optional(),
  showCompetitions: z.boolean().optional(),
  showStore: z.boolean().optional(),
  showLocations: z.boolean().optional(),
  showTeam: z.boolean().optional(),
  showTeamCertifications: z.boolean().optional(),
  competitionsHeading: z.string().optional().nullable(),
  competitionsDescription: z.string().optional().nullable(),
  competitionsCtaText: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  subdomain: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
  // Information Boxes
  infoBox1Title: z.string().optional().nullable(),
  infoBox1Content: z.string().optional().nullable(),
  infoBox2Title: z.string().optional().nullable(),
  infoBox2Content: z.string().optional().nullable(),
  infoBox3Title: z.string().optional().nullable(),
  infoBox3Content: z.string().optional().nullable(),
});

async function getPublishEligibility(organizationId: string): Promise<{
  canPublish: boolean;
  publishBlockReason: string | null;
}> {
  // tenant-isolation-ok: AdyenPlatformAccount is a platform-level model
  const platformAccount = await db.adyenPlatformAccount.findUnique({
    where: { organizationId },
    select: { onboardingStatus: true, storeId: true },
  });

  if (!platformAccount || platformAccount.onboardingStatus !== "VERIFIED") {
    return {
      canPublish: false,
      publishBlockReason:
        "Payment processing must be set up before publishing your site. Complete Adyen verification first.",
    };
  }

  if (!platformAccount.storeId) {
    return {
      canPublish: false,
      publishBlockReason:
        "Payment processing setup is not finalized. Please complete the onboarding process.",
    };
  }

  return { canPublish: true, publishBlockReason: null };
}

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    if (!organizationId) {
      console.error("No organizationId in session for user:", session.user.email);
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const [config, publishEligibility] = await Promise.all([
      db.websiteConfig.findUnique({
        where: { organizationId },
      }),
      getPublishEligibility(organizationId),
    ]);

    const publishStatus = {
      canPublish: session.user.isSuperAdmin || publishEligibility.canPublish,
      publishBlockReason: session.user.isSuperAdmin ? null : publishEligibility.publishBlockReason,
      adyenOnboardingComplete: publishEligibility.canPublish,
    };

    if (config) {
      return NextResponse.json({ ...config, subdomainOwned: true, ...publishStatus });
    }

    return NextResponse.json(publishStatus);
  } catch (error) {
    console.error("Error fetching website config:", error);
    return NextResponse.json({ error: "Failed to fetch website config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = websiteConfigSchema.parse(body);

    if (validatedData.isPublished === true && !session.user.isSuperAdmin) {
      const { canPublish, publishBlockReason } = await getPublishEligibility(
        session.user.organizationId
      );
      if (!canPublish) {
        return NextResponse.json({ error: publishBlockReason }, { status: 403 });
      }
    }

    const config = await db.websiteConfig.upsert({
      where: {
        organizationId: session.user.organizationId,
      },
      update: validatedData,
      create: {
        organizationId: session.user.organizationId,
        ...validatedData,
      },
    });

    const publishEligibility = await getPublishEligibility(session.user.organizationId);
    const publishStatus = {
      canPublish: session.user.isSuperAdmin || publishEligibility.canPublish,
      publishBlockReason: session.user.isSuperAdmin ? null : publishEligibility.publishBlockReason,
      adyenOnboardingComplete: publishEligibility.canPublish,
    };

    return NextResponse.json({ ...config, subdomainOwned: true, ...publishStatus });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating website config:", error);
    return NextResponse.json({ error: "Failed to update website config" }, { status: 500 });
  }
}
