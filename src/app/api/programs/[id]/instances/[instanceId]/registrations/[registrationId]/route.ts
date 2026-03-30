import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateRegistrationSchema = z.object({
  status: z.enum(["REGISTERED", "WAITLISTED", "CANCELLED"]),
});

// GET /api/programs/[id]/instances/[instanceId]/registrations/[registrationId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string; registrationId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { instanceId, registrationId } = await params;

    const registration = await db.instanceRegistration.findFirst({
      where: {
        id: registrationId,
        programInstanceId: instanceId,
        programInstance: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            birthDate: true,
          },
        },
        programInstance: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            program: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    return NextResponse.json(registration);
  } catch (error) {
    console.error("Error fetching registration:", error);
    return NextResponse.json({ error: "Failed to fetch registration" }, { status: 500 });
  }
}

// PATCH /api/programs/[id]/instances/[instanceId]/registrations/[registrationId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string; registrationId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("registrations.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { instanceId, registrationId } = await params;
    const body = await request.json();
    const validated = updateRegistrationSchema.parse(body);

    const existing = await db.instanceRegistration.findFirst({
      where: {
        id: registrationId,
        programInstanceId: instanceId,
        programInstance: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        programInstance: {
          select: {
            capacity: true,
            program: {
              select: { waitlistEnabled: true, waitlistAutoPromote: true },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const shouldPromoteWaitlist =
      existing.status === "REGISTERED" &&
      validated.status === "CANCELLED" &&
      existing.programInstance.program.waitlistAutoPromote;

    const registration = await db.$transaction(async (tx) => {
      const updated = await tx.instanceRegistration.update({
        where: { id: registrationId },
        data: { status: validated.status },
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      if (shouldPromoteWaitlist) {
        const nextWaitlisted = await tx.instanceRegistration.findFirst({
          where: {
            programInstanceId: instanceId,
            status: "WAITLISTED",
          },
          orderBy: { createdAt: "asc" },
        });

        if (nextWaitlisted) {
          await tx.instanceRegistration.update({
            where: { id: nextWaitlisted.id },
            data: { status: "REGISTERED" },
          });
        }
      }

      return updated;
    });

    return NextResponse.json(registration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating registration:", error);
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }
}

// DELETE /api/programs/[id]/instances/[instanceId]/registrations/[registrationId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string; registrationId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("registrations.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { instanceId, registrationId } = await params;

    const existing = await db.instanceRegistration.findFirst({
      where: {
        id: registrationId,
        programInstanceId: instanceId,
        programInstance: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        programInstance: {
          select: {
            program: {
              select: { waitlistAutoPromote: true },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const wasRegistered = existing.status === "REGISTERED";
    const shouldPromote = wasRegistered && existing.programInstance.program.waitlistAutoPromote;

    await db.$transaction(async (tx) => {
      await tx.instanceRegistration.delete({
        where: { id: registrationId },
      });

      if (shouldPromote) {
        const nextWaitlisted = await tx.instanceRegistration.findFirst({
          where: {
            programInstanceId: instanceId,
            status: "WAITLISTED",
          },
          orderBy: { createdAt: "asc" },
        });

        if (nextWaitlisted) {
          await tx.instanceRegistration.update({
            where: { id: nextWaitlisted.id },
            data: { status: "REGISTERED" },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting registration:", error);
    return NextResponse.json({ error: "Failed to delete registration" }, { status: 500 });
  }
}
