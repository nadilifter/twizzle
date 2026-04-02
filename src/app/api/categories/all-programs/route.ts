import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db"; // tenant-isolation-ok: WebsiteConfig is scoped by unique organizationId from session
import { z } from "zod";

const updateSchema = z.object({
  imageUrl: z.string().min(1).optional().nullable(),
});

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await db.websiteConfig.findUnique({
      where: { organizationId: session.user.organizationId },
      select: { allProgramsCategoryImageUrl: true },
    });

    return NextResponse.json({
      imageUrl: config?.allProgramsCategoryImageUrl ?? null,
    });
  } catch (error) {
    console.error("Error fetching all-programs category:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { imageUrl } = updateSchema.parse(body);

    const config = await db.websiteConfig.upsert({
      where: { organizationId: session.user.organizationId },
      update: { allProgramsCategoryImageUrl: imageUrl },
      create: {
        organizationId: session.user.organizationId,
        allProgramsCategoryImageUrl: imageUrl,
      },
    });

    return NextResponse.json({
      imageUrl: config.allProgramsCategoryImageUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating all-programs category:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
