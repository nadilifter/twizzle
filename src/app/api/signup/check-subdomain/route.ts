import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Reserved subdomains that cannot be used
const RESERVED_SUBDOMAINS = [
  "admin",
  "superadmin",
  "coach",
  "athletes",
  "pos",
  "feedback",
  "events",
  "signup",
  "www",
  "api",
  "app",
  "mail",
  "help",
  "support",
  "blog",
  "docs",
  "status",
  "cdn",
  "static",
  "assets",
  "images",
  "files",
  "download",
  "upload",
  "dashboard",
  "login",
  "signup",
  "register",
  "account",
  "settings",
  "billing",
  "payment",
  "checkout",
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get("subdomain")

    if (!subdomain) {
      return NextResponse.json(
        { error: "Subdomain is required" },
        { status: 400 }
      )
    }

    const normalizedSubdomain = subdomain.toLowerCase().trim()

    // Validate format
    if (normalizedSubdomain.length < 3) {
      return NextResponse.json({
        available: false,
        reason: "Subdomain must be at least 3 characters",
      })
    }

    if (normalizedSubdomain.length > 63) {
      return NextResponse.json({
        available: false,
        reason: "Subdomain must be at most 63 characters",
      })
    }

    if (!/^[a-z0-9-]+$/.test(normalizedSubdomain)) {
      return NextResponse.json({
        available: false,
        reason: "Subdomain can only contain lowercase letters, numbers, and hyphens",
      })
    }

    if (normalizedSubdomain.startsWith("-") || normalizedSubdomain.endsWith("-")) {
      return NextResponse.json({
        available: false,
        reason: "Subdomain cannot start or end with a hyphen",
      })
    }

    // Check if reserved
    if (RESERVED_SUBDOMAINS.includes(normalizedSubdomain)) {
      return NextResponse.json({
        available: false,
        reason: "This subdomain is reserved",
      })
    }

    // Check if already taken in WebsiteConfig
    const existingConfig = await db.websiteConfig.findUnique({
      where: { subdomain: normalizedSubdomain },
    })

    if (existingConfig) {
      return NextResponse.json({
        available: false,
        reason: "This subdomain is already taken",
      })
    }

    // Check if organization slug exists
    const existingOrg = await db.organization.findUnique({
      where: { slug: normalizedSubdomain },
    })

    if (existingOrg) {
      return NextResponse.json({
        available: false,
        reason: "This subdomain is already taken",
      })
    }

    // Also check reserved domains table
    const reservedDomain = await db.reservedDomain.findFirst({
      where: { pattern: normalizedSubdomain },
    })

    if (reservedDomain) {
      return NextResponse.json({
        available: false,
        reason: "This subdomain is reserved",
      })
    }

    return NextResponse.json({
      available: true,
    })

  } catch (error) {
    console.error("Subdomain check error:", error)
    return NextResponse.json(
      { error: "Failed to check subdomain availability" },
      { status: 500 }
    )
  }
}
