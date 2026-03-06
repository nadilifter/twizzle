import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { 
    ArrowLeft, 
    Calendar, 
    Clock, 
    MapPin, 
    Repeat, 
    Users, 
    UserCheck, 
    DollarSign,
    ClipboardList,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProgramRegistrationFlow } from "@/components/sites/program-registration-flow";

export default async function ProgramDetailPage({ 
    params,
}: { 
    params: { slug: string; programId: string };
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
                select: { id: true, name: true, city: true, stateProvince: true }
            },
            bulkDiscounts: true,
            levelRequirements: {
                include: {
                    level: {
                        select: { id: true, name: true, color: true },
                    },
                },
            },
            staffAssignments: {
                where: {
                    role: { in: ["LEAD_COACH", "ASSISTANT_COACH"] },
                },
                include: {
                    member: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    avatar: true,
                                },
                            },
                        },
                    },
                },
                orderBy: [
                    { isPrimary: "desc" },
                    { role: "asc" },
                ],
                take: 5,
            },
            requiredMemberships: {
                include: {
                    group: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            waiverRequirements: {
                select: { id: true, waiverId: true },
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
                select: {
                    instances: true,
                    enrollments: { where: { status: { not: "WAITLISTED" } } },
                }
            }
        }
    });

    if (!program) return notFound();

    // Fetch waitlisted enrollment count if waitlist is enabled
    const waitlistedCount = program.waitlistEnabled
        ? await db.enrollment.count({
            where: { programId: program.id, status: "WAITLISTED" },
        })
        : 0;

    const isRecurring = program.recurrenceType === "RECURRING";
    const isPerInstance = program.registrationType === "PER_INSTANCE";
    const primaryColor = config.primaryColor || "#000000";

    const totalCapacity = program.capacity || 0;
    const enrolled = program._count.enrollments || 0;
    const spotsAvailable = totalCapacity > 0 ? Math.max(0, totalCapacity - enrolled) : null;
    const isFull = program.hasCapacityRestriction && spotsAvailable === 0;
    const waitlistHasRoom = program.waitlistEnabled && (
        program.waitlistCapacity == null || waitlistedCount < program.waitlistCapacity
    );
    const canJoinWaitlist = isFull && waitlistHasRoom;

    const hasAge = program.hasAgeRestriction && (program.minAge !== null || program.maxAge !== null);
    const ageLabel = hasAge
        ? program.minAge && program.maxAge
            ? `Ages ${program.minAge}–${program.maxAge}`
            : program.minAge
            ? `Ages ${program.minAge}+`
            : `Up to age ${program.maxAge}`
        : null;

    const locationLabel = program.facility
        ? `${program.facility.name}${program.facility.city ? `, ${program.facility.city}` : ""}`
        : null;

    const priceDisplay = (program.basePrice || program.perSessionPrice)
        ? `$${Number(program.basePrice || program.perSessionPrice).toFixed(2)}`
        : "FREE";

    const serializedProgramForFlow = {
        id: program.id,
        name: program.name,
        description: program.description,
        pricingModel: program.pricingModel,
        basePrice: program.basePrice ? Number(program.basePrice) : null,
        perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : null,
        registrationType: program.registrationType,
        hasAgeRestriction: program.hasAgeRestriction,
        minAge: program.minAge,
        maxAge: program.maxAge,
        hasWaiverRestriction: program.hasWaiverRestriction,
        hasMedicalRequirement: program.hasMedicalRequirement,
        hasMembershipRestriction: program.hasMembershipRestriction,
        organizationId: config.organizationId,
        capacity: program.capacity,
        hasCapacityRestriction: program.hasCapacityRestriction,
        waitlistEnabled: program.waitlistEnabled,
        waitlistCapacity: program.waitlistCapacity,
        enrolled,
        waitlistedCount,
        requiredMemberships: program.requiredMemberships.map(m => ({
            id: m.id,
            name: m.name,
            price: Number(m.price),
            billingInterval: m.billingInterval,
            group: m.group,
        })),
        waiverRequirements: program.waiverRequirements,
    };

    const serializedInstances = program.instances.map(i => ({
        id: i.id,
        date: i.date.toISOString(),
        startTime: i.startTime,
        endTime: i.endTime,
        capacity: i.capacity || program.capacity || undefined,
        registrationCount: i._count.registrations,
        facility: i.facility ? { name: i.facility.name, city: i.facility.city } : undefined,
    }));

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <section
                className="relative py-12 md:py-16 text-white"
                style={{
                    background: `linear-gradient(to bottom right, ${primaryColor}, ${primaryColor}e6, ${primaryColor}cc)`,
                }}
            >
                <div className="mx-auto w-full max-w-4xl px-4 md:px-8">
                    <Link 
                        href="/calendar"
                        className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-6 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Calendar
                    </Link>

                    <div className="flex items-center gap-3 mb-4">
                        <ClipboardList className="h-8 w-8" />
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                            {program.name}
                        </h1>
                    </div>

                    {program.description && (
                        <p className="text-white/80 leading-relaxed max-w-2xl mb-6 whitespace-pre-line">
                            {program.description}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-white/80">
                        {program.startDate && (
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4" />
                                <span>
                                    {program.endDate
                                        ? `${format(program.startDate, "MMM d")} – ${format(program.endDate, "MMM d, yyyy")}`
                                        : format(program.startDate, "EEEE, MMMM d, yyyy")}
                                </span>
                            </div>
                        )}

                        {program.startTime && (
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                <span>
                                    {program.startTime}
                                    {program.duration ? ` (${program.duration} min)` : ""}
                                </span>
                            </div>
                        )}

                        {locationLabel && (
                            <div className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4" />
                                <span>{locationLabel}</span>
                            </div>
                        )}

                        {isRecurring && program._count.instances > 0 && (
                            <div className="flex items-center gap-1.5">
                                <Repeat className="h-4 w-4" />
                                <span>
                                    {program._count.instances} sessions
                                    {isPerInstance ? " (drop-in)" : ""}
                                </span>
                            </div>
                        )}

                        {totalCapacity > 0 && spotsAvailable !== null && (
                            <div className="flex items-center gap-1.5">
                                <Users className="h-4 w-4" />
                                <span>
                                    {spotsAvailable > 0
                                        ? `${spotsAvailable} of ${totalCapacity} spots`
                                        : canJoinWaitlist
                                        ? "Full — Waitlist available"
                                        : "Currently full"}
                                </span>
                            </div>
                        )}

                        {ageLabel && (
                            <div className="flex items-center gap-1.5">
                                <UserCheck className="h-4 w-4" />
                                <span>{ageLabel}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4" />
                            <span>
                                {priceDisplay}
                                {program.pricingModel === "PER_SESSION" ? " / session" : ""}
                            </span>
                        </div>
                    </div>

                    {/* Coaches in hero */}
                    {program.staffAssignments.length > 0 && (
                        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/20">
                            <div className="flex -space-x-2">
                                {program.staffAssignments.slice(0, 4).map((sa) => (
                                    <Avatar key={sa.id} className="h-8 w-8 border-2 border-white/30">
                                        <AvatarImage src={sa.member.user.avatar || ""} />
                                        <AvatarFallback className="text-xs bg-white/20 text-white">
                                            {sa.member.user.name?.charAt(0) || "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                ))}
                            </div>
                            <span className="text-sm text-white/70">
                                {program.staffAssignments.slice(0, 2).map(sa => sa.member.user.name).join(", ")}
                                {program.staffAssignments.length > 2 && ` +${program.staffAssignments.length - 2} more`}
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {/* Registration Flow — full width, just like competition page */}
            <section className="mx-auto w-full max-w-4xl px-4 py-12 md:px-8">
                <ProgramRegistrationFlow
                    program={serializedProgramForFlow}
                    instances={serializedInstances}
                    slug={subdomain}
                    primaryColor={primaryColor}
                />
            </section>
        </div>
    );
}
