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
    Star,
    Tag,
    AlertCircle,
    DollarSign,
    Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProgramCard } from "@/components/sites/program-card";
import { ProgramInstanceSelector } from "./instance-selector";

export default async function ProgramDetailPage({ 
    params,
    searchParams,
}: { 
    params: { slug: string; programId: string };
    searchParams: { instance?: string };
}) {
    const subdomain = params.slug;
    const programId = params.programId;
    const highlightInstanceId = searchParams.instance || null;

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
                    staffProfile: {
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

    // Capacity and availability
    const totalCapacity = program.capacity || 0;
    const enrolled = program._count.enrollments || 0;
    const spotsAvailable = totalCapacity > 0 ? Math.max(0, totalCapacity - enrolled) : null;
    const capacityPercent = totalCapacity > 0 ? Math.min(100, Math.round((enrolled / totalCapacity) * 100)) : 0;

    // Age restrictions
    const hasAge = program.hasAgeRestriction && (program.minAge !== null || program.maxAge !== null);
    const ageLabel = hasAge
        ? program.minAge && program.maxAge
            ? `Ages ${program.minAge}–${program.maxAge}`
            : program.minAge
            ? `Ages ${program.minAge}+`
            : `Up to age ${program.maxAge}`
        : null;

    // Serialize the program data for the ProgramCard client component
    const serializedProgram = {
        ...program,
        basePrice: program.basePrice ? Number(program.basePrice) : null,
        perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : null,
        bulkDiscounts: program.bulkDiscounts.map(discount => ({
            ...discount,
            discountValue: Number(discount.discountValue),
        })),
        staffAssignments: program.staffAssignments.map(assignment => ({
            id: assignment.id,
            role: assignment.role,
            isPrimary: assignment.isPrimary,
            staffProfile: {
                id: assignment.staffProfile.id,
                title: assignment.staffProfile.title,
                user: assignment.staffProfile.user,
            },
        })),
        requiredMemberships: program.requiredMemberships.map(membership => ({
            id: membership.id,
            name: membership.name,
            price: Number(membership.price),
            billingInterval: membership.billingInterval,
            group: membership.group,
        })),
    };

    return (
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-8">
            {/* Back Link */}
            <Link 
                href="/calendar"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Calendar
            </Link>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Left Column: Extended Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Program Header */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                            {isRecurring && (
                                <span className="text-xs font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 rounded-full">
                                    Recurring Program
                                </span>
                            )}
                            {isPerInstance && (
                                <span className="text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 rounded-full">
                                    Drop-in Available
                                </span>
                            )}
                            {ageLabel && (
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-full">
                                    {ageLabel}
                                </span>
                            )}
                            {program.levelRequirements?.map((lr) => (
                                <span 
                                    key={lr.id}
                                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                                    style={lr.level.color 
                                        ? { backgroundColor: `${lr.level.color}15`, color: lr.level.color } 
                                        : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                                    }
                                >
                                    {lr.level.name}
                                </span>
                            ))}
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                            {program.name}
                        </h1>
                        {program.description && (
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                                {program.description}
                            </p>
                        )}
                    </div>

                    {/* At-a-Glance Details */}
                    <div className="rounded-xl border bg-card p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Program Details</h2>
                        <div className="grid sm:grid-cols-2 gap-5">
                            {/* Dates */}
                            {program.startDate && (
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Calendar className="h-4.5 w-4.5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Dates</div>
                                        <div className="text-sm text-muted-foreground">
                                            {program.endDate ? (
                                                <>
                                                    {format(program.startDate, "MMMM d")} &ndash; {format(program.endDate, "MMMM d, yyyy")}
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
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Clock className="h-4.5 w-4.5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Time</div>
                                        <div className="text-sm text-muted-foreground">
                                            {program.startTime}
                                            {program.duration && ` (${program.duration} min)`}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Location */}
                            {program.facility && (
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <MapPin className="h-4.5 w-4.5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Location</div>
                                        <div className="text-sm text-muted-foreground">
                                            {program.facility.name}
                                            {program.facility.city && `, ${program.facility.city}`}
                                            {program.facility.stateProvince && `, ${program.facility.stateProvince}`}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Total Sessions */}
                            {isRecurring && program._count.instances > 0 && (
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Repeat className="h-4.5 w-4.5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Sessions</div>
                                        <div className="text-sm text-muted-foreground">
                                            {program._count.instances} classes
                                            {isPerInstance && " (drop-in available)"}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Capacity & Availability */}
                            {totalCapacity > 0 && (
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Users className="h-4.5 w-4.5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-foreground">Availability</div>
                                        <div className="text-sm text-muted-foreground">
                                            {spotsAvailable !== null && spotsAvailable > 0
                                                ? `${spotsAvailable} of ${totalCapacity} spots available`
                                                : spotsAvailable === 0
                                                ? "Currently full"
                                                : `${totalCapacity} spots total`}
                                        </div>
                                        {/* Capacity bar */}
                                        <div className="mt-1.5 h-1.5 w-full max-w-[180px] rounded-full bg-muted overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all ${
                                                    capacityPercent >= 90 ? 'bg-red-500' : capacityPercent >= 70 ? 'bg-orange-500' : 'bg-green-500'
                                                }`}
                                                style={{ width: `${capacityPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Age Range */}
                            {ageLabel && (
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <UserCheck className="h-4.5 w-4.5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Age Range</div>
                                        <div className="text-sm text-muted-foreground">{ageLabel}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Coaches Section */}
                    {program.staffAssignments.length > 0 && (
                        <div className="rounded-xl border bg-card p-6">
                            <h2 className="text-lg font-semibold text-foreground mb-4">Coaches</h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {program.staffAssignments.map((sa) => (
                                    <div 
                                        key={sa.id} 
                                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/40"
                                    >
                                        <Avatar className="h-10 w-10 border-2 border-background">
                                            <AvatarImage src={sa.staffProfile.user.avatar || ""} />
                                            <AvatarFallback className="text-sm font-medium">
                                                {sa.staffProfile.user.name?.charAt(0) || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-medium text-foreground truncate">
                                                    {sa.staffProfile.user.name}
                                                </span>
                                                {sa.isPrimary && (
                                                    <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {sa.staffProfile.title || (sa.role === "LEAD_COACH" ? "Lead Coach" : "Assistant Coach")}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pricing & Options Section */}
                    <div className="rounded-xl border bg-card p-6">
                            <h2 className="text-lg font-semibold text-foreground mb-4">Pricing & Options</h2>
                            
                            {/* Direct Pricing / Free */}
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 mb-4">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-foreground">
                                        {(program.basePrice || program.perSessionPrice)
                                            ? (program.pricingModel === "PER_SESSION" ? "Per Session" : "Program Fee")
                                            : "Free Program"}
                                    </span>
                                </div>
                                <span className="text-sm font-bold text-foreground">
                                    {(program.basePrice || program.perSessionPrice)
                                        ? `$${Number(program.basePrice || program.perSessionPrice).toFixed(2)}`
                                        : "FREE"}
                                </span>
                            </div>

                            {/* Bulk Discounts */}
                            {program.bulkDiscounts.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                                        <Tag className="h-4 w-4 text-green-600 dark:text-green-400" />
                                        Available Discounts
                                    </h3>
                                    <div className="space-y-2">
                                        {program.bulkDiscounts.map((discount) => {
                                            const value = Number(discount.discountValue);
                                            const label = discount.discountType === "PERCENTAGE"
                                                ? `${value}% off`
                                                : `$${value} off`;
                                            return (
                                                <div key={discount.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20">
                                                    <Badge variant="outline" className="shrink-0 text-xs text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-950/30">
                                                        {label}
                                                    </Badge>
                                                    <span className="text-xs text-green-800 dark:text-green-300">
                                                        {discount.description || (
                                                            discount.type === "FAMILY_SIBLING"
                                                                ? `Register ${discount.minQuantity}+ children and save`
                                                                : `Book ${discount.minQuantity}+ sessions and save`
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                    </div>

                    {/* Required Memberships */}
                    {program.requiredMemberships.length > 0 && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                    <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200 mb-1">
                                        Membership Required
                                    </h2>
                                    <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                                        This program requires an active membership to register. The membership will be added to your cart automatically if needed.
                                    </p>
                                    <div className="space-y-2">
                                        {program.requiredMemberships.map(m => (
                                            <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-100/50 dark:bg-amber-950/30">
                                                <div>
                                                    <div className="text-sm font-medium text-amber-900 dark:text-amber-200">{m.group.name}</div>
                                                    <div className="text-xs text-amber-700 dark:text-amber-400">{m.name}</div>
                                                </div>
                                                <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                                    ${Number(m.price).toFixed(0)}
                                                    <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                                                        /{m.billingInterval.toLowerCase().replace("ly", "")}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Instance Selection for Per-Instance Programs */}
                    {isPerInstance && program.instances.length > 0 && (
                        <div className="rounded-xl border bg-card p-6">
                            <h2 className="text-lg font-semibold text-foreground mb-2">
                                Select Sessions
                            </h2>
                            <p className="text-sm text-muted-foreground mb-4">
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
                                highlightInstanceId={highlightInstanceId}
                            />
                        </div>
                    )}

                    {/* Upcoming Sessions Preview for Full-Program Registration */}
                    {!isPerInstance && program.instances.length > 0 && (
                        <div className="rounded-xl border bg-card p-6">
                            <h2 className="text-lg font-semibold text-foreground mb-4">
                                Upcoming Sessions
                            </h2>
                            <div className="space-y-1">
                                {program.instances.slice(0, 10).map((instance) => (
                                    <div 
                                        key={instance.id}
                                        className="flex items-center justify-between py-3 border-b border-border last:border-0"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-center min-w-[50px]">
                                                <div className="text-xs font-bold text-muted-foreground uppercase">
                                                    {format(instance.date, "MMM")}
                                                </div>
                                                <div className="text-2xl font-bold text-foreground leading-tight">
                                                    {format(instance.date, "d")}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground text-sm">
                                                    {format(instance.date, "EEEE")}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {instance.startTime} &ndash; {instance.endTime}
                                                    {instance.facility && ` \u2022 ${instance.facility.name}`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {program.instances.length > 10 && (
                                    <div className="text-sm text-center text-muted-foreground pt-3">
                                        + {program.instances.length - 10} more sessions
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: ProgramCard (sticky sidebar) */}
                <div className="lg:col-span-1">
                    <div className="lg:sticky lg:top-24 space-y-4">
                        <ProgramCard 
                            program={serializedProgram}
                            primaryColor={config.primaryColor || undefined}
                        />
                        {/* Quick info note */}
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>Add to your cart and checkout when ready. Your spot is reserved once payment is completed.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
