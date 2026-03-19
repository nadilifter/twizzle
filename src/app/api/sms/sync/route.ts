import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { getMessageStatus, mapTwilioStatus, isTwilioConfigured } from "@/lib/twilio";

/**
 * POST /api/sms/sync
 * Sync pending message statuses from Twilio
 * This is useful for:
 * - Local development where webhooks don't work
 * - Fallback when webhooks fail
 */
export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isTwilioConfigured()) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 400 });
    }

    const organizationId = session.user.organizationId;
    const scopedDb = getScopedDb(organizationId);

    // Find messages that are still pending (QUEUED, SENDING, SENT)
    // Only check messages from the last 24 hours to avoid excessive API calls
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const pendingMessages = await db.smsMessage.findMany({
      where: {
        organizationId,
        twilioSid: { not: null },
        twilioStatus: {
          in: ["QUEUED", "SENDING", "SENT"],
        },
        createdAt: {
          gte: oneDayAgo,
        },
      },
      select: {
        id: true,
        twilioSid: true,
        twilioStatus: true,
      },
      take: 50, // Limit to avoid rate limits
    });

    if (pendingMessages.length === 0) {
      return NextResponse.json({
        synced: 0,
        updated: 0,
        message: "No pending messages to sync",
      });
    }

    let updated = 0;
    const errors: string[] = [];
    const details: Array<{
      id: string;
      twilioSid: string;
      oldStatus: string;
      twilioStatus: string | null;
      newStatus: string | null;
      updated: boolean;
    }> = [];

    // Check status for each pending message
    for (const msg of pendingMessages) {
      if (!msg.twilioSid) continue;

      try {
        const twilioMessage = await getMessageStatus(msg.twilioSid);
        
        if (!twilioMessage) {
          console.log(`No Twilio message found for SID: ${msg.twilioSid}`);
          details.push({
            id: msg.id,
            twilioSid: msg.twilioSid,
            oldStatus: msg.twilioStatus,
            twilioStatus: null,
            newStatus: null,
            updated: false,
          });
          continue;
        }

        console.log(`Twilio status for ${msg.twilioSid}: ${twilioMessage.status}`);
        const newStatus = mapTwilioStatus(twilioMessage.status);

        details.push({
          id: msg.id,
          twilioSid: msg.twilioSid,
          oldStatus: msg.twilioStatus,
          twilioStatus: twilioMessage.status,
          newStatus,
          updated: newStatus !== msg.twilioStatus,
        });

        // Only update if status changed
        if (newStatus !== msg.twilioStatus) {
          const updateData: {
            twilioStatus: typeof newStatus;
            deliveredAt?: Date;
            failedAt?: Date;
            errorCode?: string | null;
            errorMessage?: string | null;
          } = {
            twilioStatus: newStatus,
          };

          // Set timestamps based on status
          if (newStatus === "DELIVERED") {
            updateData.deliveredAt = new Date();
          } else if (newStatus === "FAILED" || newStatus === "UNDELIVERED") {
            updateData.failedAt = new Date();
            updateData.errorCode = twilioMessage.errorCode?.toString() || null;
            updateData.errorMessage = twilioMessage.errorMessage || null;
          }

          await scopedDb.smsMessage.update({
            where: { id: msg.id },
            data: updateData,
          });

          updated++;
        }
      } catch (error) {
        console.error(`Error syncing message ${msg.id}:`, error);
        errors.push(msg.id);
      }

      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      synced: pendingMessages.length,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      details, // Include details for debugging
      message: `Synced ${pendingMessages.length} messages, ${updated} updated`,
    });
  } catch (error) {
    console.error("Error syncing SMS statuses:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { 
        error: "Failed to sync message statuses",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
