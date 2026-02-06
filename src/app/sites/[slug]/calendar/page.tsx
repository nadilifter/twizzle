import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { SiteCalendar } from "./site-calendar";

export default async function CalendarPage({ params }: { params: { slug: string } }) {
    const subdomain = params.slug;

    const config = await db.websiteConfig.findUnique({
        where: { subdomain },
        select: {
            organizationId: true,
            organization: {
                select: { name: true }
            }
        }
    });

    if (!config) return notFound();

    return (
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12">
            <h1 className="text-3xl font-bold mb-8 text-center">Schedule & Calendar</h1>
            <SiteCalendar
                slug={subdomain}
                organizationId={config.organizationId}
                organizationName={config.organization.name}
            />
        </div>
    );
}
