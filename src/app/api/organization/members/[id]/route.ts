import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";
import { isValidPhoneNumber } from "react-phone-number-input";

const phoneOptional = z.string()
  .refine((val) => !val || isValidPhoneNumber(val), "Please enter a valid phone number")
  .optional().nullable();

const updateMemberSchema = z.object({
  // Employment fields
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACTOR", "VOLUNTEER"]).optional().nullable(),
  title: z.string().optional().nullable(),
  hourlyRate: z.number().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  certifications: z.array(z.object({
    name: z.string(),
    expiresAt: z.string().optional().nullable(),
    verified: z.boolean().optional(),
  })).optional().nullable(),
  phone: phoneOptional,
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string().refine(isValidPhoneNumber, "Please enter a valid phone number"),
    relationship: z.string().optional(),
  }).optional().nullable(),
  // Role and permissions
  role: z.enum(["ADMIN", "COACH", "VOLUNTEER", "ACCOUNTANT", "CUSTOM", "PARENT"]).optional(),
  permissions: z.array(z.string()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id } = await params;

    const member = await db.organizationMember.findFirst({
      where: { id, organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            phone: true,
            status: true,
            createdAt: true,
            lastActiveAt: true,
          },
        },
        permissions: true,
        availability: { orderBy: { dayOfWeek: "asc" } },
        shifts: {
          orderBy: { date: "desc" },
          take: 20,
          include: { facility: { select: { name: true } } },
        },
        eventAssignments: {
          take: 20,
          include: {
            event: { select: { id: true, title: true, date: true } },
          },
        },
        programAssignments: {
          include: {
            program: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            shifts: true,
            eventAssignments: true,
            programAssignments: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json({ error: "Failed to fetch member" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("users.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existingMember = await db.organizationMember.findFirst({
      where: { id, organizationId },
    });

    if (!existingMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validatedData.employmentType !== undefined) updateData.employmentType = validatedData.employmentType;
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.hourlyRate !== undefined) updateData.hourlyRate = validatedData.hourlyRate;
    if (validatedData.hireDate !== undefined) updateData.hireDate = validatedData.hireDate ? parseDateOnly(validatedData.hireDate) : null;
    if (validatedData.certifications !== undefined) updateData.certifications = validatedData.certifications;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.emergencyContact !== undefined) updateData.emergencyContact = validatedData.emergencyContact;
    if (validatedData.role !== undefined) updateData.role = validatedData.role;

    await db.$transaction(async (tx) => {
      await tx.organizationMember.update({
        where: { id, organizationId },
        data: updateData,
      });

      if (validatedData.permissions !== undefined) {
        await tx.orgMemberPermission.deleteMany({ where: { memberId: id } });
        if (validatedData.permissions.length > 0) {
          await tx.orgMemberPermission.createMany({
            data: validatedData.permissions.map((permission) => ({
              memberId: id,
              permission,
            })),
          });
        }
      }
    });

    const member = await db.organizationMember.findFirst({
      where: { id, organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            phone: true,
            status: true,
            createdAt: true,
            lastActiveAt: true,
          },
        },
        permissions: true,
        availability: { orderBy: { dayOfWeek: "asc" } },
        _count: {
          select: {
            shifts: true,
            eventAssignments: true,
            programAssignments: true,
          },
        },
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating member:", error);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}
