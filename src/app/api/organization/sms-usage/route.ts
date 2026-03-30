import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUsageStats, checkUsageLimits, getCurrentBillingPeriod } from "@/lib/sms-service";
import { isTwilioConfigured } from "@/lib/twilio";

// GET /api/organization/sms-usage - Get SMS usage for current organization
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // Get current usage stats
    const usage = await getUsageStats(organizationId);

    // Get limits
    const limits = await checkUsageLimits(organizationId);

    // Get plan info
    const subscription = await db.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        plan: {
          select: {
            name: true,
            smsIncluded: true,
            smsOverageRate: true,
          },
        },
      },
    });

    // Get recent message stats (last 30 days by day)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await db.message.groupBy({
      by: ["twilioStatus"],
      where: {
        organizationId,
        createdAt: { gte: thirtyDaysAgo },
        direction: "OUTBOUND",
      },
      _count: true,
    });

    // Get message count by day for charting
    const messagesByDay = (await db.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN twilio_status = 'DELIVERED' THEN 1 END) as delivered,
        COUNT(CASE WHEN twilio_status = 'FAILED' OR twilio_status = 'UNDELIVERED' THEN 1 END) as failed
      FROM "SmsMessage"
      WHERE organization_id = ${organizationId}
        AND created_at >= ${thirtyDaysAgo}
        AND direction = 'OUTBOUND'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `) as Array<{ date: Date; count: bigint; delivered: bigint; failed: bigint }>;

    // Transform BigInt to number for JSON serialization
    const chartData = messagesByDay.map((day) => ({
      date: day.date,
      count: Number(day.count),
      delivered: Number(day.delivered),
      failed: Number(day.failed),
    }));

    // Calculate delivery rate
    const totalSent = usage?.messagesSent || 0;
    const totalDelivered = usage?.messagesDelivered || 0;
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

    return NextResponse.json({
      usage,
      limits: {
        allowed: limits.allowed,
        remaining: limits.remaining,
        used: limits.used,
        included: limits.included,
        overageRate: limits.overageRate,
      },
      plan: subscription?.plan
        ? {
            name: subscription.plan.name,
            smsIncluded: subscription.plan.smsIncluded,
            smsOverageRate: subscription.plan.smsOverageRate
              ? Number(subscription.plan.smsOverageRate)
              : null,
          }
        : null,
      stats: {
        deliveryRate: Math.round(deliveryRate * 10) / 10,
        statusBreakdown: dailyStats.reduce(
          (acc, stat) => {
            acc[stat.twilioStatus] = stat._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
      chartData,
      configured: isTwilioConfigured(),
      billingPeriod: getCurrentBillingPeriod(),
    });
  } catch (error) {
    console.error("Error fetching SMS usage:", error);
    return NextResponse.json({ error: "Failed to fetch SMS usage" }, { status: 500 });
  }
}
