import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSportsSchema = z.object({
  sportIds: z.array(z.string()),
});

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const orgSports = await db.organizationSport.findMany({
      where: { organizationId },
      include: {
        sport: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
          },
        },
      },
      orderBy: { sport: { displayOrder: "asc" } },
    });

    return NextResponse.json(orgSports.map((os) => os.sport));
  } catch (error) {
    console.error("Failed to fetch organization sports:", error);
    return NextResponse.json({ error: "Failed to fetch sports" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const body = await request.json();
    const { sportIds } = updateSportsSchema.parse(body);

    // Validate that all sport IDs exist and are active
    if (sportIds.length > 0) {
      const validSports = await db.sport.findMany({
        where: { id: { in: sportIds }, isActive: true },
        select: { id: true },
      });
      const validIds = new Set(validSports.map((s) => s.id));
      const invalidIds = sportIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: "One or more selected sports are invalid or inactive" },
          { status: 400 }
        );
      }
    }

    // Replace all organization sports in a transaction
    await db.$transaction(async (tx) => {
      await tx.organizationSport.deleteMany({
        where: { organizationId },
      });

      if (sportIds.length > 0) {
        await tx.organizationSport.createMany({
          data: sportIds.map((sportId) => ({
            organizationId,
            sportId,
          })),
        });
      }
    });

    // Return the updated list
    const updatedSports = await db.organizationSport.findMany({
      where: { organizationId },
      include: {
        sport: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
          },
        },
      },
      orderBy: { sport: { displayOrder: "asc" } },
    });

    return NextResponse.json(updatedSports.map((os) => os.sport));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Failed to update organization sports:", error);
    return NextResponse.json({ error: "Failed to update sports" }, { status: 500 });
  }
}
