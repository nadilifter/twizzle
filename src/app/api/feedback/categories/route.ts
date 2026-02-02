import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Predefined categories for consistency
const PREDEFINED_CATEGORIES = [
  "UI/UX",
  "Mobile",
  "Performance",
  "Integrations",
  "Analytics",
  "API",
  "Security",
  "Communication",
  "Scheduling",
  "Athletes",
  "Programs",
  "Financials",
  "Other",
]

// GET /api/feedback/categories
// List all available categories
export async function GET(request: NextRequest) {
  try {
    // Get categories from existing public features
    const features = await db.featureRequest.findMany({
      where: {
        isPublic: true,
        status: { not: "SUBMITTED" },
      },
      select: {
        categories: true,
      },
    })

    // Collect unique categories from features
    const usedCategories = new Set<string>()
    features.forEach((f) => {
      f.categories.forEach((cat) => usedCategories.add(cat))
    })

    // Combine predefined and used categories
    const allCategories = new Set([...PREDEFINED_CATEGORIES, ...usedCategories])

    // Count features per category
    const categoryCounts: Record<string, number> = {}
    for (const category of allCategories) {
      const count = await db.featureRequest.count({
        where: {
          isPublic: true,
          status: { not: "SUBMITTED" },
          categories: { has: category },
        },
      })
      categoryCounts[category] = count
    }

    // Return categories sorted alphabetically with counts
    const categoriesWithCounts = Array.from(allCategories)
      .sort()
      .map((name) => ({
        name,
        count: categoryCounts[name] || 0,
      }))

    return NextResponse.json({
      data: categoriesWithCounts,
      predefined: PREDEFINED_CATEGORIES,
    })
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}
