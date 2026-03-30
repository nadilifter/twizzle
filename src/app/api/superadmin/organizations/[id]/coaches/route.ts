import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

// GET /api/superadmin/organizations/[id]/coaches
// Returns users with coaching permissions in the organization for superadmin impersonation
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();

    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: organizationId } = await params;

    const members = await db.organizationMember.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        permissions: true,
      },
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    });

    // Filter to members who have coaching.portal permission
    // either via explicit OrgMemberPermission or via their role template defaults
    const coaches = members
      .filter((m) => {
        const explicitPerms = m.permissions.map((p) => p.permission);
        if (explicitPerms.includes("*") || explicitPerms.includes("coaching.portal")) {
          return true;
        }
        // Fall back to role template if no explicit permissions
        if (explicitPerms.length === 0) {
          const rolePerms = ROLE_PERMISSIONS[m.role] || [];
          return rolePerms.includes("*" as never) || rolePerms.includes("coaching.portal" as never);
        }
        return false;
      })
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatar: m.user.avatar,
        role: m.role,
      }));

    return NextResponse.json({
      data: coaches,
      total: coaches.length,
    });
  } catch (error) {
    console.error("Error fetching organization coaches:", error);
    return NextResponse.json({ error: "Failed to fetch coaches" }, { status: 500 });
  }
}
