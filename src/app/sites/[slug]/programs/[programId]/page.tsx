import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { 
    Calendar, 
    Clock, 
    MapPin, 
    Users, 
    ArrowLeft,
    CheckCircle,
    AlertCircle
} from "lucide-react";
import { ProgramInstanceSelector } from "./instance-selector";

export default async function ProgramDetailPage({ 
    params 
}: { 
    params: { slug: string; programId: string } 
}) {
    const subdomain = params.slug;
    const programId = params.programId;

    const config = await db.websiteConfig.findUnique({
        where: { subdomain },
        select: { organizationId: true, primaryColor: true }
    });

    if (!config) return notFound();

    const program = await db.program.findFirst({
        where: {
            id: programId,
            organizationId: config.organizationId,
            status: "ACTIVE",
        },
        include: {
            facility: {
                select: { id: true, name: true, address: true, city: true, stateProvince: true }
            },
            programLevel: {
                select: { id: true, name: true, color: true }
            },
            staffAssignments: {
                where: { isPrimary: true },
                include: {
                    staffProfile: {
                        include: {
                            user: { select: { name: true, avatar: true } }
                        }
                    }
                },
                take: 3
            },
            membershipTiers: true,
            requiredMemberships: {
                include: {
                    group: { select: { id: true, name: true } }
                }
            },
            instances: {
                where: {
                    date: { gte: new Date() },
                    status: "SCHEDULED"
                },
                include: {
                    facility: { select: { id: true, name: true, city: true } },
                    _count: { select: { registrations: true } }
                },
                orderBy: { date: "asc" },
                take: 50
            },
            _count: {
                select: { instances: true, enrollments: true }
            }
        }
    });

    if (!program) return notFound();

    const isRecurring = program.recurrenceType === "RECURRING";
    const isPerInstance = program.registrationType === "PER_INSTANCE";

    // Calculate spots available
    const totalCapacity = program.capacity || 0;
    const enrolled = program._count.enrollments || 0;
    const spotsAvailable = totalCapacity > 0 ? totalCapacity - enrolled : null;

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* Back Link */}
            <Link 
                href={`/sites/${subdomain}/register`} 
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Programs
            </Link>

            {/* Program Header */}
            <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            {program.programLevel && (
                                <span 
                                    className="text-xs font-medium px-2 py-1 rounded-full"
                                    style={{ 
                                        backgroundColor: program.programLevel.color ? `${program.programLevel.color}20` : undefined,
                                        color: program.programLevel.color || undefined
                                    }}
                                >
                                    {program.programLevel.name}
                                </span>
                            )}
                            {isRecurring && (
                                <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                                    Recurring Program
                                </span>
                            )}
                            {isPerInstance && (
                                <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
                                    Drop-in Available
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
                            {program.name}
                        </h1>
                        {program.description && (
                            <p className="text-slate-600 mb-4">{program.description}</p>
                        )}
                    </div>

                    {/* Pricing */}
                    <div className="text-right">
                        {program.basePrice && (
                            <div className="text-2xl font-bold text-slate-900">
                                ${Number(program.basePrice).toFixed(0)}
                                {program.pricingModel === "PER_SESSION" && (
                                    <span className="text-sm font-normal text-slate-500">/session</span>
                                )}
                            </div>
                        )}
                        {spotsAvailable !== null && (
                            <div className={`text-sm mt-1 ${spotsAvailable > 5 ? 'text-green-600' : spotsAvailable > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                {spotsAvailable > 0 ? `${spotsAvailable} spots left` : 'Full'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Schedule & Location Info */}
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t mt-4">
                    {/* Date Range */}
                    {program.startDate && (
                        <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-slate-700">Dates</div>
                                <div className="text-sm text-slate-600">
                                    {program.endDate ? (
                                        <>
                                            {format(program.startDate, "MMM d")} - {format(program.endDate, "MMM d, yyyy")}
                                        </>
                                    ) : (
                                        format(program.startDate, "EEEE, MMMM d, yyyy")
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Time & Duration */}
                    {program.startTime && (
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-slate-400 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-slate-700">Time</div>
                                <div className="text-sm text-slate-600">
                                    {program.startTime}
                                    {program.duration && ` (${program.duration} min)`}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Location */}
                    {program.facility && (
                        <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-slate-700">Location</div>
                                <div className="text-sm text-slate-600">
                                    {program.facility.name}
                                    {program.facility.city && `, ${program.facility.city}`}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Total Sessions */}
                    {isRecurring && program._count.instances > 0 && (
                        <div className="flex items-start gap-3">
                            <Users className="h-5 w-5 text-slate-400 mt-0.5" />
                            <div>
                                <div className="text-sm font-medium text-slate-700">Total Sessions</div>
                                <div className="text-sm text-slate-600">
                                    {program._count.instances} classes
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Coaches */}
                {program.staffAssignments.length > 0 && (
                    <div className="pt-4 border-t mt-4">
                        <div className="text-sm font-medium text-slate-700 mb-2">Coached by</div>
                        <div className="flex items-center gap-3">
                            {program.staffAssignments.map((sa) => (
                                <div key={sa.id} className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                                        {sa.staffProfile.user.name?.charAt(0) || "?"}
                                    </div>
                                    <span className="text-sm text-slate-600">{sa.staffProfile.user.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Required Memberships Warning */}
                {program.requiredMemberships.length > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                            <div>
                                <div className="font-medium text-amber-800">Membership Required</div>
                                <div className="text-sm text-amber-700">
                                    This program requires: {program.requiredMemberships.map(m => m.group.name).join(", ")}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Instance Selection for Per-Instance Programs */}
            {isPerInstance && program.instances.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">
                        Select Sessions to Register
                    </h2>
                    <p className="text-sm text-slate-600 mb-4">
                        Choose individual sessions you&apos;d like to attend. You can register for one or multiple sessions.
                    </p>
                    <ProgramInstanceSelector 
                        instances={program.instances.map(i => ({
                            id: i.id,
                            date: i.date.toISOString(),
                            startTime: i.startTime,
                            endTime: i.endTime,
                            capacity: i.capacity || program.capacity || undefined,
                            registrationCount: i._count.registrations,
                            facility: i.facility ? { name: i.facility.name, city: i.facility.city } : undefined
                        }))}
                        program={{
                            id: program.id,
                            name: program.name,
                            perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : undefined
                        }}
                        subdomain={subdomain}
                    />
                </div>
            )}

            {/* Upcoming Sessions Preview */}
            {!isPerInstance && program.instances.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">
                        Upcoming Sessions
                    </h2>
                    <div className="space-y-3">
                        {program.instances.slice(0, 5).map((instance) => (
                            <div 
                                key={instance.id}
                                className="flex items-center justify-between py-3 border-b last:border-0"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="text-center min-w-[50px]">
                                        <div className="text-sm font-bold text-slate-900">
                                            {format(instance.date, "MMM")}
                                        </div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {format(instance.date, "d")}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-900">
                                            {format(instance.date, "EEEE")}
                                        </div>
                                        <div className="text-sm text-slate-600">
                                            {instance.startTime} - {instance.endTime}
                                            {instance.facility && ` • ${instance.facility.name}`}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-500">
                                    {instance.capacity && (
                                        <span>
                                            {instance._count.registrations}/{instance.capacity}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {program.instances.length > 5 && (
                            <div className="text-sm text-center text-slate-500 pt-2">
                                + {program.instances.length - 5} more sessions
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Register Button for Full Program */}
            {!isPerInstance && (
                <div className="bg-white rounded-xl border shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-slate-900">Register for Full Program</div>
                            <div className="text-sm text-slate-600">
                                Enroll for all {program._count.instances} sessions
                            </div>
                        </div>
                        <Link
                            href={`/sites/${subdomain}/register?program=${program.id}`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                        >
                            <CheckCircle className="h-5 w-5" />
                            Register Now
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
