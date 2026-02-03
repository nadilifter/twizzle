import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  PLACEHOLDER_DEFINITIONS,
  getPlaceholdersForTrigger,
  getPlaceholdersByCategory,
  type PlaceholderCategory,
} from "@/lib/notification-template-service";
import type { NotificationTriggerType } from "@prisma/client";

// GET /api/notifications/placeholders
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const triggerType = searchParams.get("triggerType") as NotificationTriggerType | null;
    const category = searchParams.get("category") as PlaceholderCategory | null;

    let placeholders = PLACEHOLDER_DEFINITIONS;

    // Filter by trigger type if specified
    if (triggerType) {
      placeholders = getPlaceholdersForTrigger(triggerType);
    }

    // Filter by category if specified
    if (category) {
      placeholders = placeholders.filter((p) => p.category === category);
    }

    // Group placeholders by category for easier UI rendering
    const grouped = placeholders.reduce((acc, placeholder) => {
      if (!acc[placeholder.category]) {
        acc[placeholder.category] = [];
      }
      acc[placeholder.category].push(placeholder);
      return acc;
    }, {} as Record<PlaceholderCategory, typeof placeholders>);

    return NextResponse.json({
      placeholders,
      grouped,
      categories: Object.keys(grouped),
    });
  } catch (error) {
    console.error("Error fetching placeholders:", error);
    return NextResponse.json(
      { error: "Failed to fetch placeholders" },
      { status: 500 }
    );
  }
}
