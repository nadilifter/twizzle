import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { SiteCalendar } from "./site-calendar";

const getCachedCalendarConfig = unstable_cache(
    async (subdomain: string) => {
        return db.websiteConfig.findUnique({
            where: { subdomain },
            select: {
                organizationId: true,
                organization: {
                    select: { name: true }
                }
            }
        });
    },
    ["site-config-calendar"],
    { revalidate: 30 }
);

const getCachedCalendarFilterData = unstable_cache(
    async (organizationId: string) => {
        const [levels, coachAssignments] = await Promise.all([
            db.level.findMany({
                where: { organizationId },
                select: { id: true, name: true, color: true },
                orderBy: { order: "asc" },
            }),
            db.programStaff.findMany({
                where: {
                    role: { in: ["LEAD_COACH", "ASSISTANT_COACH"] },
                    program: { organizationId, status: "ACTIVE" },
                },
                select: {
                    member: {
                        select: {
                            user: { select: { id: true, name: true, avatar: true } },
                        },
                    },
                },
                distinct: ["memberId"],
            }),
        ]);

        const coachMap = new Map<string, { id: string; name: string; avatar: string | null }>();
        for (const sa of coachAssignments) {
            const user = sa.member.user;
            if (!coachMap.has(user.id)) {
                coachMap.set(user.id, { id: user.id, name: user.name, avatar: user.avatar });
            }
        }
        const coaches = Array.from(coachMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        return { levels, coaches };
    },
    ["site-calendar-filter-data"],
    { revalidate: 30 }
);

const getCachedSeasons = unstable_cache(
    async (organizationId: string) => {
        return db.season.findMany({
            where: { organizationId, status: { in: ["ACTIVE", "DRAFT"] } },
            select: { id: true, name: true, color: true },
            orderBy: { startDate: "desc" },
        });
    },
    ["site-seasons"],
    { revalidate: 30 }
);

const getCachedCalendarCategories = unstable_cache(
    async (organizationId: string) => {
        return db.category.findMany({
            where: { organizationId },
            select: { id: true, name: true },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        });
    },
    ["site-calendar-categories"],
    { revalidate: 30 }
);

export default async function CalendarPage({ params }: { params: { slug: string } }) {
    const subdomain = params.slug;

    const config = await getCachedCalendarConfig(subdomain);

    if (!config) return notFound();

    const [{ levels, coaches }, trainingEnabled, seasonsEnabled] = await Promise.all([
        getCachedCalendarFilterData(config.organizationId),
        isFeatureEnabled(config.organizationId, "training"),
        isFeatureEnabled(config.organizationId, "seasons"),
    ]);

    const [seasons, calendarCategories] = await Promise.all([
        seasonsEnabled ? getCachedSeasons(config.organizationId) : Promise.resolve([]),
        getCachedCalendarCategories(config.organizationId),
    ]);

    return (
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12">
            <h1 className="text-3xl font-bold mb-8 text-center">Schedule & Calendar</h1>
            <SiteCalendar
                slug={subdomain}
                organizationId={config.organizationId}
                organizationName={config.organization.name}
                levels={trainingEnabled ? levels : []}
                coaches={coaches}
                seasons={seasons}
                categories={calendarCategories}
            />
        </div>
    );
}
