import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/calendar/instance/[instanceId] - Get a single program instance with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { instanceId } = await params;

    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        organizationId: session.user.organizationId,
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            description: true,
            basePrice: true,
            perSessionPrice: true,
            recurrenceType: true,
            registrationType: true,
          },
        },
        facility: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        registrations: {
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                birthDate: true,
                avatar: true,
              },
            },
            family: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [
            { status: "asc" },
            { createdAt: "asc" },
          ],
        },
        attendances: {
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            registrations: true,
            attendances: true,
          },
        },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(instance);
  } catch (error) {
    console.error("Error fetching instance:", error);
    return NextResponse.json(
      { error: "Failed to fetch instance" },
      { status: 500 }
    );
  }
}
