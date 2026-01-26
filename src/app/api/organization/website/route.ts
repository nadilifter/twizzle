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
  showCalendar: z.boolean().optional(),
  showRegistration: z.boolean().optional(),
  showLogin: z.boolean().optional(),
  showContact: z.boolean().optional(),
  domain: z.string().optional().nullable(),
  subdomain: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await db.websiteConfig.findUnique({
      where: {
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(config || {});
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

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Error updating website config:", error);
    return NextResponse.json({ error: "Failed to update website config" }, { status: 500 });
  }
}
