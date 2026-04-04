import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { getOrganizationFeatures } from "@/lib/feature-resolver";

const EMPTY_RESPONSE = {
  staff: [],
  guardians: [],
  athletes: [],
  programs: [],
  events: [],
  competitions: [],
  memberships: [],
  categories: [],
  seasons: [],
};

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get("search")?.trim();
  if (!search || search.length < 2) {
    return NextResponse.json(EMPTY_RESPONSE);
  }

  const organizationId = session.user.organizationId;
  const scopedDb = getScopedDb(organizationId);
  const features = await getOrganizationFeatures(organizationId);

  const nameFilter = { contains: search, mode: "insensitive" as const };
  const take = 10;

  const [
    staff,
    guardians,
    athletes,
    programs,
    events,
    competitions,
    memberships,
    categories,
    seasons,
  ] = await Promise.all([
    // tenant-isolation-ok: OrganizationMember is a tenant model, scopedDb auto-injects organizationId
    scopedDb.organizationMember.findMany({
      where: {
        user: {
          name: nameFilter,
          email: { not: { endsWith: "@uplifterinc.com" } },
        },
      },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
      take,
    }),
    // tenant-isolation-ok: User has no organizationId; scoped through athleteGuardian -> athlete -> organizationAthlete
    db.user.findMany({
      where: {
        name: nameFilter,
        athleteGuardians: {
          some: {
            athlete: {
              organizationAthletes: { some: { organizationId } },
            },
          },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take,
    }),
    // tenant-isolation-ok: Athlete has no organizationId; scoped through organizationAthletes junction
    db.athlete.findMany({
      where: {
        organizationAthletes: { some: { organizationId } },
        OR: [{ firstName: nameFilter }, { lastName: nameFilter }, { name: nameFilter }],
      },
      select: { id: true, firstName: true, lastName: true, name: true },
      orderBy: { lastName: "asc" },
      take,
    }),
    scopedDb.program.findMany({
      where: { name: nameFilter },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take,
    }),
    features.events
      ? scopedDb.event.findMany({
          where: { title: nameFilter },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
          take,
        })
      : Promise.resolve([]),
    features.competitions
      ? scopedDb.competition.findMany({
          where: { name: nameFilter },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take,
        })
      : Promise.resolve([]),
    features.memberships
      ? scopedDb.membershipGroup.findMany({
          where: { name: nameFilter },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take,
        })
      : Promise.resolve([]),
    scopedDb.category.findMany({
      where: { name: nameFilter },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take,
    }),
    features.seasons
      ? scopedDb.season.findMany({
          where: { name: nameFilter },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    staff: staff.map((m) => ({ id: m.id, name: m.user.name })),
    guardians,
    athletes: athletes.map((a) => ({
      id: a.id,
      name: [a.firstName, a.lastName].filter(Boolean).join(" ") || a.name,
    })),
    programs,
    events: events.map((e: { id: string; title: string }) => ({
      id: e.id,
      name: e.title,
    })),
    competitions,
    memberships,
    categories,
    seasons,
  });
}
