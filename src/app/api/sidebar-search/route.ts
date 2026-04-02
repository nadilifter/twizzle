import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { getOrganizationFeatures } from "@/lib/feature-resolver";

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get("search")?.trim();
  if (!search || search.length < 2) {
    return NextResponse.json({
      programs: [],
      events: [],
      competitions: [],
      memberships: [],
      categories: [],
      seasons: [],
    });
  }

  const organizationId = session.user.organizationId;
  const scopedDb = getScopedDb(organizationId);
  const features = await getOrganizationFeatures(organizationId);

  const nameFilter = { contains: search, mode: "insensitive" as const };
  const take = 10;

  const [programs, events, competitions, memberships, categories, seasons] = await Promise.all([
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
