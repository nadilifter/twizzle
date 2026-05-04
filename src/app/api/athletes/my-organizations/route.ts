import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
// tenant-isolation-ok: user-scoped athlete portal route, queries across orgs by user identity
import { db } from "@/lib/db";
import { athleteDisplayName } from "@/lib/athlete-name";
import { getSubdomainUrl } from "@/lib/env-domains";

interface OrgConnection {
  type: "member" | "athlete";
  detail: string;
}

interface OrgAccumulator {
  id: string;
  name: string;
  logo: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  stateProvince: string | null;
  siteUrl: string;
  connections: OrgConnection[];
  isMember: boolean;
}

/**
 * GET /api/athletes/my-organizations
 *
 * Returns all organizations connected to the current user that have a
 * published public website. Connections come from:
 * - OrganizationMember (direct membership)
 * - AthleteGuardian -> Athlete -> OrganizationAthlete
 * - Self-athlete (Athlete.userId) -> OrganizationAthlete
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId =
      session.user.isSuperAdmin && session.user.viewingAsUserId
        ? session.user.viewingAsUserId
        : session.user.id;

    const orgMap = new Map<string, OrgAccumulator>();

    const orgSelect = {
      id: true,
      name: true,
      logo: true,
      email: true,
      phone: true,
      city: true,
      stateProvince: true,
      isActive: true,
      websiteConfig: {
        select: {
          subdomain: true,
          domain: true,
          isPublished: true,
        },
      },
    } as const;

    type OrgRow = {
      id: string;
      name: string;
      logo: string | null;
      email: string | null;
      phone: string | null;
      city: string | null;
      stateProvince: string | null;
      isActive: boolean;
      websiteConfig: {
        subdomain: string | null;
        domain: string | null;
        isPublished: boolean;
      } | null;
    };

    const getSiteUrl = (org: OrgRow): string | null => {
      const wc = org.websiteConfig;
      if (!org.isActive || !wc?.isPublished) return null;
      if (wc.domain) return `https://${wc.domain}`;
      if (wc.subdomain) return getSubdomainUrl(wc.subdomain);
      return null;
    };

    const upsertOrg = (org: OrgRow, conn: OrgConnection, isMember: boolean) => {
      const siteUrl = getSiteUrl(org);
      if (!siteUrl) return;

      const existing = orgMap.get(org.id);
      if (existing) {
        if (isMember) existing.isMember = true;
        const isDupe = existing.connections.some(
          (c) => c.type === conn.type && c.detail === conn.detail
        );
        if (!isDupe) existing.connections.push(conn);
      } else {
        orgMap.set(org.id, {
          id: org.id,
          name: org.name,
          logo: org.logo,
          email: org.email,
          phone: org.phone,
          city: org.city,
          stateProvince: org.stateProvince,
          siteUrl,
          connections: [conn],
          isMember,
        });
      }
    };

    // 1. Direct memberships
    const memberships = await db.organizationMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        organization: { isActive: true },
      },
      include: {
        organization: { select: orgSelect },
      },
    });

    for (const m of memberships) {
      const conn: OrgConnection = {
        type: "member",
        detail: m.role.charAt(0) + m.role.slice(1).toLowerCase(),
      };
      upsertOrg(m.organization, conn, true);
    }

    // 2. Guardian links -> athlete -> org
    const guardianLinks = await db.athleteGuardian.findMany({
      where: { userId },
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationAthletes: {
              include: {
                organization: { select: orgSelect },
              },
            },
          },
        },
      },
    });

    for (const link of guardianLinks) {
      const athlete = link.athlete;
      const athleteName = athleteDisplayName(athlete);
      for (const oa of athlete.organizationAthletes) {
        upsertOrg(oa.organization, { type: "athlete", detail: athleteName }, false);
      }
    }

    // 3. Self-athlete -> org
    const selfAthletes = await db.athlete.findMany({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        organizationAthletes: {
          include: {
            organization: { select: orgSelect },
          },
        },
      },
    });

    for (const athlete of selfAthletes) {
      const athleteName = athleteDisplayName(athlete);
      for (const oa of athlete.organizationAthletes) {
        upsertOrg(oa.organization, { type: "athlete", detail: athleteName }, false);
      }
    }

    const adminBaseUrl = getSubdomainUrl("admin");

    const organizations = Array.from(orgMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ isMember, ...org }) => ({
        ...org,
        dashboardUrl: isMember
          ? `${adminBaseUrl}/switch-org?orgId=${org.id}&orgName=${encodeURIComponent(org.name)}`
          : null,
      }));

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("GET /api/athletes/my-organizations error:", error);
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }
}
