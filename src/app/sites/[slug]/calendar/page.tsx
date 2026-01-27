import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";

export default async function CalendarPage({ params }: { params: { slug: string } }) {
    const subdomain = params.slug;

    const config = await db.websiteConfig.findUnique({
        where: { subdomain },
        select: { organizationId: true }
    });

    if (!config) return notFound();

    const events = await db.event.findMany({
        where: {
            organizationId: config.organizationId,
            date: {
                gte: new Date() // Future events
            }
        },
        orderBy: {
            date: 'asc'
        },
        take: 50
    });

    return (
        <div className="container mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold mb-8 text-center">Class Calendar</h1>
            {events.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-slate-50">
                    <p className="text-muted-foreground text-lg">No upcoming classes scheduled.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {events.map(event => (
                        <div key={event.id} className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full capitalize">
                                        {event.type.toLowerCase()}
                                    </span>
                                    <span className="text-sm text-slate-500">
                                        {format(event.date, "MMM d")}
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 line-clamp-2">{event.title}</h2>
                            </div>
                            
                            <div className="space-y-2 mb-4 text-sm text-slate-600">
                                <div className="flex items-center gap-2">
                                    <span>🕒</span>
                                    <span>{event.startTime} - {event.endTime}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>📅</span>
                                    <span>{format(event.date, "EEEE, MMMM d, yyyy")}</span>
                                </div>
                            </div>

                            {event.description && (
                                <p className="text-sm text-slate-500 line-clamp-3 mb-4 flex-grow">
                                    {event.description}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
