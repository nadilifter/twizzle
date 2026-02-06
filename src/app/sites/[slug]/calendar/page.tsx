import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { Calendar, Clock, MapPin, Users, Repeat } from "lucide-react";

type CalendarItem = {
    id: string;
    title: string;
    date: Date;
    startTime: string;
    endTime: string;
    description?: string | null;
    type: "event" | "program-instance";
    facility?: { name: string; city?: string | null } | null;
    program?: { 
        id: string; 
        name: string; 
        registrationType?: string | null;
        capacity?: number | null;
    } | null;
    capacity?: number | null;
    _count?: { registrations?: number };
};

export default async function CalendarPage({ params }: { params: { slug: string } }) {
    const subdomain = params.slug;

    const config = await db.websiteConfig.findUnique({
        where: { subdomain },
        select: { organizationId: true }
    });

    if (!config) return notFound();

    // Fetch both events and program instances
    const [events, programInstances] = await Promise.all([
        db.event.findMany({
            where: {
                organizationId: config.organizationId,
                date: { gte: new Date() }
            },
            include: {
                facility: { select: { name: true, city: true } },
            },
            orderBy: { date: 'asc' },
            take: 50
        }),
        db.programInstance.findMany({
            where: {
                organizationId: config.organizationId,
                date: { gte: new Date() },
                status: "SCHEDULED",
                program: {
                    status: "ACTIVE"
                }
            },
            include: {
                program: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        registrationType: true,
                        capacity: true,
                    }
                },
                facility: { select: { name: true, city: true } },
                _count: { select: { registrations: true } },
            },
            orderBy: { date: 'asc' },
            take: 100
        })
    ]);

    // Combine and sort by date
    const calendarItems: CalendarItem[] = [
        ...events.map(event => ({
            id: event.id,
            title: event.title,
            date: event.date,
            startTime: event.startTime || "",
            endTime: event.endTime || "",
            description: event.description,
            type: "event" as const,
            facility: event.facility,
        })),
        ...programInstances.map(instance => ({
            id: instance.id,
            title: instance.program.name,
            date: instance.date,
            startTime: instance.startTime,
            endTime: instance.endTime,
            description: instance.program.description,
            type: "program-instance" as const,
            facility: instance.facility,
            program: instance.program,
            capacity: instance.capacity || instance.program.capacity,
            _count: instance._count,
        }))
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Group by date for better display
    const groupedItems = calendarItems.reduce((acc, item) => {
        const dateKey = format(item.date, "yyyy-MM-dd");
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(item);
        return acc;
    }, {} as Record<string, CalendarItem[]>);

    const dateGroups = Object.entries(groupedItems).map(([dateKey, items]) => ({
        date: new Date(dateKey),
        items: items.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }));

    return (
        <div className="container mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold mb-8 text-center">Schedule & Calendar</h1>
            
            {calendarItems.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-slate-50">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-lg">No upcoming classes or events scheduled.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {dateGroups.map(({ date, items }) => (
                        <div key={date.toISOString()} className="space-y-4">
                            {/* Date Header */}
                            <div className="sticky top-0 bg-background/95 backdrop-blur py-2 border-b">
                                <h2 className="text-lg font-semibold text-slate-800">
                                    {format(date, "EEEE, MMMM d, yyyy")}
                                </h2>
                            </div>

                            {/* Items for this date */}
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {items.map(item => (
                                    <div 
                                        key={item.id} 
                                        className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                                    >
                                        <div className="mb-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                    item.type === "program-instance" 
                                                        ? "text-green-700 bg-green-50"
                                                        : "text-blue-700 bg-blue-50"
                                                }`}>
                                                    {item.type === "program-instance" ? "Class" : "Event"}
                                                </span>
                                                {item.type === "program-instance" && item.program?.registrationType === "PER_INSTANCE" && (
                                                    <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
                                                        Drop-in OK
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900 line-clamp-2">
                                                {item.title}
                                            </h3>
                                        </div>
                                        
                                        <div className="space-y-2 mb-4 text-sm text-slate-600">
                                            {/* Time */}
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-slate-400" />
                                                <span>{item.startTime} - {item.endTime}</span>
                                            </div>

                                            {/* Location */}
                                            {item.facility && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4 text-slate-400" />
                                                    <span>
                                                        {item.facility.name}
                                                        {item.facility.city && `, ${item.facility.city}`}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Capacity for program instances */}
                                            {item.type === "program-instance" && item.capacity && (
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-slate-400" />
                                                    <span>
                                                        {item._count?.registrations || 0} / {item.capacity} spots filled
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {item.description && (
                                            <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-grow">
                                                {item.description}
                                            </p>
                                        )}

                                        {/* Action button for program instances */}
                                        {item.type === "program-instance" && item.program && (
                                            <div className="mt-auto pt-3 border-t">
                                                <Link 
                                                    href={`/sites/${subdomain}/programs/${item.program.id}`}
                                                    className="block w-full text-center py-2 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                                >
                                                    View Program Details
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
