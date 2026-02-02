import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/superadmin/organizations/[id]/coaches
// Returns coaches (users with COACH role) in the organization for superadmin impersonation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    
    // Only superadmins can access this endpoint
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: organizationId } = await params;

    // Get all members of the organization who are coaches (or have coach-like roles)
    const members = await db.organizationMember.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        // Include COACH, ADMIN roles (admins often also act as coaches)
        role: { in: ["COACH", "ADMIN", "STAFF"] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
      orderBy: [
        { role: "asc" },
        { user: { name: "asc" } },
      ],
    });

    const coaches = members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.role, // Use the membership role, not the user's global role
    }));

    return NextResponse.json({
      data: coaches,
      total: coaches.length,
    });
  } catch (error) {
    console.error("Error fetching organization coaches:", error);
    return NextResponse.json(
      { error: "Failed to fetch coaches" },
      { status: 500 }
    );
  }
}
