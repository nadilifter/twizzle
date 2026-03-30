import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import type {
  FacilityActivityItem,
  FacilityActivitySort,
  FacilityActivityType,
} from "@/types/facilities";

const ACTIVITY_SORTS: FacilityActivitySort[] = [
  "date_asc",
  "date_desc",
  "name_asc",
  "name_desc",
  "type_asc",
  "type_desc",
];

const ACTIVITY_TYPES: FacilityActivityType[] = [
  "event",
  "program",
  "program_instance",
  "competition",
];

const RAW_FETCH_LIMIT = 300;

function parseActivityQuery(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const pageRaw = parseInt(sp.get("page") ?? "1", 10);
  const pageSizeRaw = parseInt(sp.get("pageSize") ?? "20", 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const pageSize = Math.min(100, Math.max(5, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 20));

  const sortRaw = sp.get("sort") ?? "date_asc";
  const sort = ACTIVITY_SORTS.includes(sortRaw as FacilityActivitySort)
    ? (sortRaw as FacilityActivitySort)
    : "date_asc";

  const typesParam = sp.get("types");
  let typesFilter: FacilityActivityType[] | null = null;
  if (typesParam && typesParam.trim()) {
    const parts = typesParam
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const valid = parts.filter((t): t is FacilityActivityType =>
      ACTIVITY_TYPES.includes(t as FacilityActivityType)
    );
    if (valid.length > 0) {
      typesFilter = [...new Set(valid)];
    }
  }

  const q = (sp.get("q") ?? "").trim().toLowerCase();

  return { page, pageSize, sort, typesFilter, q };
}

function compareActivityItems(
  a: FacilityActivityItem,
  b: FacilityActivityItem,
  sort: FacilityActivitySort
): number {
  switch (sort) {
    case "date_desc":
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    case "name_asc":
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    case "name_desc":
      return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
    case "type_asc":
      return (
        a.type.localeCompare(b.type) || new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    case "type_desc":
      return (
        b.type.localeCompare(a.type) || new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    case "date_asc":
    default:
      return new Date(a.date).getTime() - new Date(b.date).getTime();
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id } = await params;
    const { page, pageSize, sort, typesFilter, q } = parseActivityQuery(request);

    const scopedDb = getScopedDb(organizationId);

    const facility = await scopedDb.facility.findFirst({
      where: { id },
      select: { id: true },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const now = new Date();

    const [events, programs, programInstances, competitions] = await Promise.all([
      scopedDb.event.findMany({
        where: {
          facilityId: id,
          date: { gte: now },
        },
        select: {
          id: true,
          title: true,
          date: true,
          startTime: true,
          endTime: true,
          type: true,
        },
        orderBy: { date: "asc" },
        take: RAW_FETCH_LIMIT,
      }),
      scopedDb.program.findMany({
        where: {
          facilityId: id,
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
        orderBy: { startDate: "asc" },
        take: RAW_FETCH_LIMIT,
      }),
      scopedDb.programInstance.findMany({
        where: {
          facilityId: id,
          date: { gte: now },
          status: "SCHEDULED",
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          program: { select: { id: true, name: true } },
        },
        orderBy: { date: "asc" },
        take: RAW_FETCH_LIMIT,
      }),
      scopedDb.competition.findMany({
        where: {
          facilityId: id,
          startDate: { gte: now },
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
        orderBy: { startDate: "asc" },
        take: RAW_FETCH_LIMIT,
      }),
    ]);

    const items: FacilityActivityItem[] = [];

    for (const e of events) {
      items.push({
        id: e.id,
        type: "event",
        name: e.title,
        date: e.date.toISOString(),
        endDate: null,
        status: e.type,
        detail: e.startTime && e.endTime ? `${e.startTime} - ${e.endTime}` : null,
        href: `/dashboard/events/${e.id}`,
      });
    }

    for (const p of programs) {
      items.push({
        id: p.id,
        type: "program",
        name: p.name,
        date: p.startDate?.toISOString() ?? now.toISOString(),
        endDate: p.endDate?.toISOString() ?? null,
        status: p.status,
        detail: null,
        href: `/dashboard/registrations/programs/${p.id}`,
      });
    }

    for (const pi of programInstances) {
      items.push({
        id: pi.id,
        type: "program_instance",
        name: `${pi.program.name} (Session)`,
        date: pi.date.toISOString(),
        endDate: null,
        status: pi.status,
        detail: `${pi.startTime} - ${pi.endTime}`,
        href: `/dashboard/calendar/instance/${pi.id}`,
      });
    }

    for (const c of competitions) {
      items.push({
        id: c.id,
        type: "competition",
        name: c.name,
        date: c.startDate.toISOString(),
        endDate: c.endDate?.toISOString() ?? null,
        status: c.status,
        detail: null,
        href: `/dashboard/competitions/${c.id}`,
      });
    }

    let filtered = items;
    if (typesFilter && typesFilter.length > 0) {
      const set = new Set(typesFilter);
      filtered = filtered.filter((item) => set.has(item.type));
    }
    if (q) {
      filtered = filtered.filter((item) => item.name.toLowerCase().includes(q));
    }

    filtered.sort((a, b) => compareActivityItems(a, b, sort));

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      items: pageItems,
      total,
      page: safePage,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching facility activity:", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
