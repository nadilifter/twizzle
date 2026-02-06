import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProgramCard } from "@/components/sites/program-card";
import { QueueGateWrapper } from "@/components/sites/queue-gate-wrapper";

export default async function RegisterPage({ params }: { params: { slug: string } }) {
    const subdomain = params.slug;

    const config = await db.websiteConfig.findUnique({
        where: { subdomain },
        select: { organizationId: true, primaryColor: true }
    });

    if (!config) return notFound();

    const programs = await db.program.findMany({
        where: {
            organizationId: config.organizationId,
            status: "ACTIVE"
        },
        include: {
            membershipTiers: true,
            programLevel: true,
            bulkDiscounts: true,
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
                take: 3,
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
        }
    });

    const serializedPrograms = programs.map(program => ({
        ...program,
        // Serialize decimal fields to numbers
        basePrice: program.basePrice ? Number(program.basePrice) : null,
        perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : null,
        membershipTiers: program.membershipTiers.map(tier => ({
            ...tier,
            price: Number(tier.price)
        })),
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
    }));

    return (
        <QueueGateWrapper>
            <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12">
                <h1 className="text-3xl font-bold mb-8 text-center">Registration</h1>
                <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12">
                    Browse our available programs and find the perfect fit for you. 
                    Register online to secure your spot today.
                </p>
                
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {serializedPrograms.map(program => (
                        <ProgramCard 
                            key={program.id} 
                            program={program} 
                            primaryColor={config.primaryColor || undefined} 
                        />
                    ))}
                </div>

                {programs.length === 0 && (
                    <div className="text-center py-16 border rounded-xl bg-slate-50">
                        <p className="text-muted-foreground text-lg">No programs are currently open for registration.</p>
                    </div>
                )}
            </div>
        </QueueGateWrapper>
    );
}
