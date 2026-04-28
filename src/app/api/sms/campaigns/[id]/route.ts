import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { db, getScopedDb } from "@/lib/db";

// GET /api/sms/campaigns/[id] - Get campaign details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsBlocked = await checkFeatureGate(session.user.organizationId, "sms");
    if (smsBlocked) return smsBlocked;

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.view")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const campaign = await db.smsCampaign.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error fetching SMS campaign:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

// PATCH /api/sms/campaigns/[id] - Update campaign (cancel or send)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsBlocked = await checkFeatureGate(session.user.organizationId, "sms");
    if (smsBlocked) return smsBlocked;

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const campaign = await db.smsCampaign.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (body.action === "cancel") {
      if (campaign.status === "COMPLETED" || campaign.status === "SENDING") {
        return NextResponse.json(
          { error: "Campaign cannot be cancelled in its current status" },
          { status: 400 }
        );
      }

      const scopedDb = getScopedDb(session.user.organizationId);
      await scopedDb.smsCampaign.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return NextResponse.json({
        success: true,
        message: "Campaign cancelled",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating SMS campaign:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

// DELETE /api/sms/campaigns/[id] - Delete a draft campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smsBlocked = await checkFeatureGate(session.user.organizationId, "sms");
    if (smsBlocked) return smsBlocked;

    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("communication.send")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const campaign = await db.smsCampaign.findUnique({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft campaigns can be deleted" }, { status: 400 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.smsCampaign.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting SMS campaign:", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
