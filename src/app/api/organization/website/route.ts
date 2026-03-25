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

    const config = await db.websiteConfig.findUnique({
      where: {
        organizationId: organizationId,
      },
    });

    // If config exists, mark the subdomain as owned by this org
    if (config) {
      return NextResponse.json({ 
        ...config, 
        subdomainOwned: true // Flag to indicate this org owns the subdomain
      });
    }

    return NextResponse.json({});
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

    // Include subdomainOwned flag so frontend knows this org owns this subdomain
    return NextResponse.json({ ...config, subdomainOwned: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating website config:", error);
    return NextResponse.json({ error: "Failed to update website config" }, { status: 500 });
  }
}
