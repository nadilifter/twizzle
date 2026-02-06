import { NextRequest, NextResponse } from "next/server";

// MembershipTier model has been removed. These endpoints are deprecated.

// GET /api/programs/[id]/tiers - Returns empty array for backward compatibility
export async function GET() {
  return NextResponse.json([]);
}

// POST /api/programs/[id]/tiers - No longer supported
export async function POST() {
  return NextResponse.json(
    { error: "Membership tiers have been removed. Use program pricing directly." },
    { status: 410 }
  );
}
