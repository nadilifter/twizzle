import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/env-domains";
import { logger } from "@/lib/logger";
import { z } from "zod";
import crypto from "crypto";

const inviteGuardianSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("users.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = inviteGuardianSchema.parse(body);

    const organization = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const baseUrl = getBaseUrl();
    const inviteUrl = `${baseUrl}/accept-invitation?token=${invitationToken}`;

    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
      select: { id: true, name: true, email: true },
    });

    const invitation = await db.$transaction(async (tx) => {
      let userId: string;

      if (existingUser) {
        userId = existingUser.id;

        const existingMembership = await tx.organizationMember.findFirst({
          where: {
            organizationId: session.user.organizationId,
            userId,
          },
          select: { id: true },
        });

        if (!existingMembership) {
          await tx.organizationMember.create({
            data: {
              organizationId: session.user.organizationId,
              userId,
              role: "PARENT",
              status: "INVITED",
            },
          });
        }
      } else {
        const user = await tx.user.create({
          data: {
            name: validatedData.name,
            email: validatedData.email,
            role: "PARENT",
            status: "INVITED",
          },
        });
        userId = user.id;

        await tx.organizationMember.create({
          data: {
            organizationId: session.user.organizationId,
            userId,
            role: "PARENT",
            status: "INVITED",
          },
        });
      }

      await tx.organizationInvitation.updateMany({
        where: {
          email: validatedData.email,
          organizationId: session.user.organizationId,
          status: "PENDING",
        },
        data: { status: "EXPIRED" },
      });

      return tx.organizationInvitation.create({
        data: {
          email: validatedData.email,
          token: invitationToken,
          organizationId: session.user.organizationId,
          role: "PARENT",
          invitedById: session.user.id,
          expiresAt,
        },
      });
    });

    try {
      if (existingUser) {
        await sendTemplatedEmail("invitation-existing-user", [validatedData.email], {
          name: existingUser.name,
          inviterName: session.user.name || "A team member",
          organizationName: organization.name,
          joinUrl: inviteUrl,
        });
      } else {
        await sendTemplatedEmail("invitation", [validatedData.email], {
          inviterName: session.user.name || "A team member",
          organizationName: organization.name,
          inviteUrl,
        });
      }

      await db.organizationInvitation.update({
        where: { id: invitation.id },
        data: { emailSentAt: new Date() },
      });
    } catch (emailError) {
      logger.error("Failed to send guardian invitation email", {
        email: validatedData.email,
        invitationId: invitation.id,
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
    }

    return NextResponse.json({ status: "invited" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error inviting guardian:", error);
    return NextResponse.json({ error: "Failed to invite guardian" }, { status: 500 });
  }
}
