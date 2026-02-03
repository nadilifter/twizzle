import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getNotificationLogs } from "@/lib/notification-service";
import type { NotificationTriggerType, NotificationLogStatus } from "@prisma/client";

// GET /api/notifications/logs
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get("ruleId") || undefined;
    const status = searchParams.get("status") as NotificationLogStatus | null;
    const triggerType = searchParams.get("triggerType") as NotificationTriggerType | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const logs = await getNotificationLogs(session.user.organizationId, {
      ruleId,
      status: status || undefined,
      triggerType: triggerType || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      data: logs,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching notification logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification logs" },
      { status: 500 }
    );
  }
}
