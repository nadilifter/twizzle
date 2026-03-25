import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { z } from "zod";

const teamHighlightSchema = z.object({
  highlights: z.array(
    z.object({
      memberId: z.string(),
      displayOrder: z.number().int().min(0),
      overrideImage: z.string().nullable().optional(),
      bio: z.string().nullable().optional(),
      isVisible: z.boolean().optional(),
    })
  ),
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

    const scopedDb = getScopedDb(organizationId);

    const highlights = await scopedDb.teamMemberHighlight.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        member: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
      },
    });

    return NextResponse.json(highlights);
  } catch (error) {
    console.error("Error fetching team highlights:", error);
    return NextResponse.json({ error: "Failed to fetch team highlights" }, { status: 500 });
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
    const { highlights } = teamHighlightSchema.parse(body);

    // Validate all memberIds belong to this org
    const memberIds = highlights.map((h) => h.memberId);
    if (memberIds.length > 0) {
      const validMembers = await db.organizationMember.findMany({
        where: { id: { in: memberIds }, organizationId },
        select: { id: true },
      });
      const validIds = new Set(validMembers.map((m) => m.id));
      const invalidIds = memberIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: "Invalid member IDs: members do not belong to this organization" },
          { status: 400 }
        );
      }
    }

    // Full replacement: delete existing highlights not in new list, upsert the rest
    await db.$transaction(async (tx) => {
      // Remove highlights for members not in the incoming list
      await tx.teamMemberHighlight.deleteMany({
        where: {
          organizationId,
          ...(memberIds.length > 0
            ? { memberId: { notIn: memberIds } }
            : {}),
        },
      });

      // If the list is empty, we just cleared everything
      if (memberIds.length === 0) return;

      // Upsert each highlight
      for (const h of highlights) {
        await tx.teamMemberHighlight.upsert({
          where: {
            organizationId_memberId: {
              organizationId,
              memberId: h.memberId,
            },
          },
          update: {
            displayOrder: h.displayOrder,
            ...(h.overrideImage !== undefined && { overrideImage: h.overrideImage }),
            ...(h.bio !== undefined && { bio: h.bio }),
            isVisible: h.isVisible ?? true,
          },
          create: {
            organizationId,
            memberId: h.memberId,
            displayOrder: h.displayOrder,
            overrideImage: h.overrideImage ?? null,
            bio: h.bio ?? null,
            isVisible: h.isVisible ?? true,
          },
        });
      }
    });

    // Return updated list
    const scopedDb = getScopedDb(organizationId);
    const updated = await scopedDb.teamMemberHighlight.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        member: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating team highlights:", error);
    return NextResponse.json({ error: "Failed to update team highlights" }, { status: 500 });
  }
}
