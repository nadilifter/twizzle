import { NextRequest, NextResponse } from "next/server";

// MembershipTier model has been removed. These endpoints are deprecated.

const goneResponse = () =>
  NextResponse.json(
    { error: "Membership tiers have been removed. Use program pricing directly." },
    { status: 410 }
  );

// GET /api/programs/[id]/tiers/[tierId]
export async function GET() {
  return goneResponse();
}

// PUT /api/programs/[id]/tiers/[tierId]
export async function PUT() {
  return goneResponse();
}

// DELETE /api/programs/[id]/tiers/[tierId]
export async function DELETE() {
  return goneResponse();
}
