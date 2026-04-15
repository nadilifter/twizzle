import { unstable_cache } from "next/cache";
import { getScopedDb } from "@/lib/db";
import { getCacheVersion } from "@/lib/cache-version";
import { notFound } from "next/navigation";
import { ProgramProfile, type ProgramProfileData } from "@/components/sites/program-profile";
import {
  getCachedSiteConfig,
  getEnrollmentCounts,
  getInstanceRegistrationCounts,
  resolveRegistrationAccess,
  serializeInstances,
} from "./shared";

/**
 * Profile-specific program query: includes full facility (lat/lng for map),
 * all staff roles (up to 10), waiver titles, but NOT passes or gender
 * restrictions on membership groups (those are only needed by the register page).
 */
const getCachedProgramDetail = unstable_cache(
  async (programId: string, organizationId: string, _version: number) => {
    const scopedDb = getScopedDb(organizationId);
    const program = await scopedDb.program.findFirst({
      where: { id: programId, status: "ACTIVE" },
      include: {
        facility: {
          select: {
            id: true,
            name: true,
            city: true,
            stateProvince: true,
            street: true,
            latitude: true,
            longitude: true,
          },
        },
        bulkDiscounts: true,
        levelRequirements: {
          include: {
            level: { select: { id: true, name: true, color: true } },
          },
        },
        staffAssignments: {
          where: { role: { in: ["LEAD_COACH", "ASSISTANT_COACH", "SUBSTITUTE", "VOLUNTEER"] } },
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, avatar: true } },
              },
            },
          },
          orderBy: [{ isPrimary: "desc" }, { role: "asc" }],
          take: 10,
        },
        requiredMemberships: {
          include: {
            group: {
              select: { id: true, name: true },
            },
          },
        },
        waiverRequirements: {
          include: {
            waiver: { select: { id: true, title: true } },
          },
        },
        category: {
          select: { id: true, name: true },
        },
        instances: {
          where: { date: { gte: new Date() }, status: "SCHEDULED" },
          include: {
            facility: { select: { id: true, name: true, city: true } },
          },
          orderBy: { date: "asc" },
          take: 100,
        },
        _count: {
          select: { instances: true },
        },
      },
    });

    return program;
  },
  ["site-program-detail"],
  { revalidate: 3600 }
);

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string; programId: string };
  searchParams: { code?: string };
}) {
  const subdomain = params.slug;
  const programId = params.programId;
  const earlyAccessCode = searchParams.code || null;

  const config = await getCachedSiteConfig(subdomain);
  if (!config) return notFound();

  const programsVersion = await getCacheVersion(config.organizationId, "programs");
  const program = await getCachedProgramDetail(programId, config.organizationId, programsVersion);
  if (!program) return notFound();

  const primaryColor = config.primaryColor || "#000000";
  const [{ enrolled, waitlistedCount }, instanceCounts] = await Promise.all([
    getEnrollmentCounts(program.id, program.waitlistEnabled),
    getInstanceRegistrationCounts(program.instances.map((i) => i.id)),
  ]);
  const { registrationStatus, hasValidEarlyAccess, canRegister } = resolveRegistrationAccess(
    program,
    earlyAccessCode
  );

  const profileData: ProgramProfileData = {
    id: program.id,
    name: program.name,
    description: program.description,
    registrationType: program.registrationType,
    pricingModel: program.pricingModel,
    basePrice: program.basePrice ? Number(program.basePrice) : null,
    perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : null,
    billingInterval: program.billingInterval,
    recurringPrice: program.recurringPrice ? Number(program.recurringPrice) : null,
    startDate: program.startDate ? new Date(program.startDate).toISOString() : null,
    endDate: program.endDate ? new Date(program.endDate).toISOString() : null,
    rrule: program.rrule,
    startTime: program.startTime,
    duration: program.duration,
    capacity: program.capacity,
    hasCapacityRestriction: program.hasCapacityRestriction,
    hasAgeRestriction: program.hasAgeRestriction,
    minAge: program.minAge,
    maxAge: program.maxAge,
    hasGenderRestriction: program.hasGenderRestriction,
    allowedGenders: program.allowedGenders,
    showCoachOnSite: program.showCoachOnSite,
    waitlistEnabled: program.waitlistEnabled,
    waitlistCapacity: program.waitlistCapacity,
    registrationStartDate: program.registrationStartDate
      ? new Date(program.registrationStartDate).toISOString()
      : null,
    imageUrl: program.imageUrl,
    facility: program.facility,
    staffAssignments: program.staffAssignments.map((sa) => ({
      id: sa.id,
      role: sa.role,
      isPrimary: sa.isPrimary,
      member: {
        id: sa.member.id,
        user: {
          id: sa.member.user.id,
          name: sa.member.user.name,
          avatar: sa.member.user.avatar,
        },
      },
    })),
    levelRequirements: program.levelRequirements.map((lr) => ({
      id: lr.id,
      level: { id: lr.level.id, name: lr.level.name, color: lr.level.color },
    })),
    bulkDiscounts: program.bulkDiscounts.map((d) => ({
      id: d.id,
      type: d.type as "FAMILY_SIBLING" | "MULTI_SESSION",
      minQuantity: d.minQuantity,
      discountType: d.discountType as "PERCENTAGE" | "FIXED_AMOUNT",
      discountValue: Number(d.discountValue),
    })),
    requiredMemberships: program.requiredMemberships.map((m) => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      billingInterval: m.billingInterval,
      group: { id: m.group.id, name: m.group.name },
    })),
    category: program.category,
    instanceCount: program._count.instances,
    enrolled,
    waitlistedCount,
    waiverNames: program.waiverRequirements.map((wr) => wr.waiver.title),
    hasMedicalRequirement: program.hasMedicalRequirement,
    hasFileRequirement: program.hasFileRequirement,
  };

  const serializedInstances = serializeInstances(
    program.instances,
    program.capacity,
    instanceCounts
  );

  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12">
        <ProgramProfile
          program={profileData}
          instances={serializedInstances}
          registrationStatus={registrationStatus}
          canRegister={canRegister}
          hasValidEarlyAccess={hasValidEarlyAccess}
          earlyAccessCode={earlyAccessCode}
          primaryColor={primaryColor}
        />
      </section>
    </div>
  );
}
