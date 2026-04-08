import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  isPublished: z.boolean(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const body = await request.json();

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request body" },
        { status: 400 }
      );
    }

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const config = await db.websiteConfig.upsert({
      where: { organizationId },
      update: { isPublished: parsed.data.isPublished },
      create: { organizationId, isPublished: parsed.data.isPublished },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating website publish status:", error);
    return NextResponse.json({ error: "Failed to update website publish status" }, { status: 500 });
  }
}
