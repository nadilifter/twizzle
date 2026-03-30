import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { admitNextInQueue, lockQueueConfig } from "@/lib/queue-utils";

// POST /api/queue/complete - Mark registration as complete
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json({ error: "Session token is required" }, { status: 400 });
    }

    const entry = await db.queueEntry.findUnique({
      where: { sessionToken },
      include: { reservation: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
    }

    if (entry.status !== "ADMITTED") {
      return NextResponse.json({ error: "Entry is not in admitted status" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      await lockQueueConfig(tx, entry.queueConfigId);

      await tx.queueEntry.update({
        where: { id: entry.id },
        data: {
          status: "COMPLETED",
          exitedAt: new Date(),
        },
      });

      if (entry.reservation) {
        await tx.queueReservation.update({
          where: { id: entry.reservation.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      }

      await admitNextInQueue(tx, entry.queueConfigId);
    });

    return NextResponse.json({
      success: true,
      message: "Registration completed successfully",
    });
  } catch (error) {
    console.error("Error completing registration:", error);
    return NextResponse.json({ error: "Failed to complete registration" }, { status: 500 });
  }
}
