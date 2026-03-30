import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

// tenant-isolation-ok: Organization grace period is a platform-level concern; superadmin-only

const extendSchema = z.object({
  action: z.literal("extend"),
  days: z.number().int().min(1).max(365),
  reason: z.string().min(1, "Reason is required when extending a grace period"),
});

const clearSchema = z.object({
  action: z.literal("clear"),
  reason: z.string().min(1, "Reason is required when clearing a grace period"),
});

const gracePeriodSchema = z.discriminatedUnion("action", [extendSchema, clearSchema]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const body = await request.json();
    const parsed = gracePeriodSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        isActive: true,
        scheduledDeactivationDate: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const data = parsed.data;
    const adminId = session.user.id;
    const adminName = session.user.name ?? session.user.email ?? "Superadmin";

    switch (data.action) {
      case "extend": {
        if (!org.scheduledDeactivationDate) {
          return NextResponse.json(
            { error: "This organization is not in a grace period. There is nothing to extend." },
            { status: 400 }
          );
        }

        const currentDate = new Date(org.scheduledDeactivationDate);
        const newDate = new Date(currentDate);
        newDate.setUTCDate(newDate.getUTCDate() + data.days);
        // Normalize to noon UTC
        newDate.setUTCHours(12, 0, 0, 0);

        await db.organization.update({
          where: { id: organizationId },
          data: {
            scheduledDeactivationDate: newDate,
            dunningWarningsSent: Prisma.DbNull,
          },
        });

        await db.organizationStatusLog.create({
          data: {
            organizationId,
            action: "GRACE_PERIOD_EXTENDED",
            reason: data.reason,
            notes: `Extended by ${data.days} day(s). New deactivation date: ${newDate.toISOString().slice(0, 10)}. Extended by ${adminName}.`,
            performedBy: adminId,
          },
        });

        logger.info("Grace period extended by superadmin", {
          organizationId,
          adminId,
          days: data.days,
          newDeactivationDate: newDate.toISOString(),
          reason: data.reason,
        });

        return NextResponse.json({
          success: true,
          message: `Grace period for ${org.name} extended by ${data.days} day(s). New deactivation date: ${newDate.toLocaleDateString()}.`,
          newDeactivationDate: newDate.toISOString(),
        });
      }

      case "clear": {
        if (!org.scheduledDeactivationDate) {
          return NextResponse.json(
            { error: "This organization is not in a grace period." },
            { status: 400 }
          );
        }

        await db.organization.update({
          where: { id: organizationId },
          data: {
            scheduledDeactivationDate: null,
            dunningWarningsSent: Prisma.DbNull,
          },
        });

        await db.organizationSubscription.updateMany({
          where: { organizationId, status: "PAST_DUE" },
          data: { status: "ACTIVE" },
        });

        await db.organizationStatusLog.create({
          data: {
            organizationId,
            action: "GRACE_PERIOD_CLEARED",
            reason: data.reason,
            notes: `Grace period cleared by ${adminName}. Subscription restored to ACTIVE.`,
            performedBy: adminId,
          },
        });

        logger.info("Grace period cleared by superadmin", {
          organizationId,
          adminId,
          reason: data.reason,
        });

        return NextResponse.json({
          success: true,
          message: `Grace period for ${org.name} has been cleared. Subscription restored to active.`,
        });
      }
    }
  } catch (error) {
    console.error("Error managing grace period:", error);
    return NextResponse.json({ error: "Failed to update grace period" }, { status: 500 });
  }
}
