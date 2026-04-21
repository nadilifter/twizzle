import { unstable_cache } from "next/cache";
import { getScopedDb } from "@/lib/db";
import { getCacheVersion } from "@/lib/cache-version";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft, Ban, Hourglass } from "lucide-react";
import { ProgramRegistrationFlow } from "@/components/sites/program-registration-flow";
import type { FileRequirementConfig } from "@/types/file-requirements";
import {
  getCachedSiteConfig,
  getEnrollmentCounts,
  getInstanceRegistrationCounts,
  resolveRegistrationAccess,
  serializeInstances,
} from "../shared";

/**
 * Register-specific program query: includes passes, gender restrictions on
 * membership groups, and registration window fields needed by the stepper.
 * Does NOT include lat/lng, waiver titles, or extra staff roles (profile-only).
 */
const getCachedProgramDetail = unstable_cache(
  async (programId: string, organizationId: string, _version: number) => {
    const scopedDb = getScopedDb(organizationId);
    const program = await scopedDb.program.findFirst({
      where: { id: programId, status: "ACTIVE" },
      include: {
        facility: {
          select: { id: true, name: true, city: true, stateProvince: true },
        },
        bulkDiscounts: true,
        levelRequirements: {
          include: {
            level: { select: { id: true, name: true, color: true } },
          },
        },
        staffAssignments: {
          where: { role: { in: ["LEAD_COACH", "ASSISTANT_COACH"] } },
          include: {
            member: {
              include: {
                user: { select: { id: true, name: true, avatar: true } },
              },
            },
          },
          orderBy: [{ isPrimary: "desc" }, { role: "asc" }],
          take: 5,
        },
        requiredMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                hasGenderRestriction: true,
                allowedGenders: true,
              },
            },
          },
        },
        requiredPasses: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            price: true,
            billingInterval: true,
            sessionLimit: true,
            limitPeriod: true,
            hasGenderRestriction: true,
            allowedGenders: true,
          },
        },
        waiverRequirements: {
          select: { id: true, waiverId: true },
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
  ["site-program-detail-register"],
  { revalidate: 3600 }
);

export default async function ProgramRegisterPage({
  params,
  searchParams,
}: {
  params: { slug: string; programId: string };
  searchParams: { code?: string; instances?: string };
}) {
  const subdomain = params.slug;
  const programId = params.programId;
  const earlyAccessCode = searchParams.code || null;
  const preSelectedInstanceParam = searchParams.instances || null;

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

  const serializedProgram = {
    id: program.id,
    name: program.name,
    description: program.description,
    pricingModel: program.pricingModel,
    basePrice: program.basePrice ? Number(program.basePrice) : null,
    perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : null,
    billingInterval: program.billingInterval,
    recurringPrice: program.recurringPrice ? Number(program.recurringPrice) : null,
    registrationType: program.registrationType,
    hasAgeRestriction: program.hasAgeRestriction,
    minAge: program.minAge,
    maxAge: program.maxAge,
    hasGenderRestriction: program.hasGenderRestriction,
    allowedGenders: program.allowedGenders,
    hasWaiverRestriction: program.hasWaiverRestriction,
    hasMedicalRequirement: program.hasMedicalRequirement,
    hasFileRequirement: program.hasFileRequirement,
    fileRequirementConfig: program.fileRequirementConfig as FileRequirementConfig | null,
    hasMembershipRestriction: program.hasMembershipRestriction,
    organizationId: config.organizationId,
    capacity: program.capacity,
    hasCapacityRestriction: program.hasCapacityRestriction,
    waitlistEnabled: program.waitlistEnabled,
    waitlistCapacity: program.waitlistCapacity,
    enrolled,
    waitlistedCount,
    requiredMemberships: program.requiredMemberships.map((m) => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      billingInterval: m.billingInterval,
      group: {
        id: m.group.id,
        name: m.group.name,
        hasGenderRestriction: m.group.hasGenderRestriction,
        allowedGenders: m.group.allowedGenders,
      },
    })),
    hasPassRestriction: program.hasPassRestriction,
    requiredPasses: (program.requiredPasses || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      billingInterval: p.billingInterval,
      sessionLimit: p.sessionLimit,
      limitPeriod: p.limitPeriod,
      hasGenderRestriction: p.hasGenderRestriction,
      allowedGenders: p.allowedGenders,
    })),
    bulkDiscounts: program.bulkDiscounts.map((d) => ({
      id: d.id,
      type: d.type,
      minQuantity: d.minQuantity,
      discountType: d.discountType,
      discountValue: Number(d.discountValue),
    })),
    waiverRequirements: program.waiverRequirements,
    registrationOpen: program.registrationOpen,
    registrationStartDate: program.registrationStartDate
      ? new Date(program.registrationStartDate).toISOString()
      : null,
    registrationStartTime: program.registrationStartTime,
    registrationEndDate: program.registrationEndDate
      ? new Date(program.registrationEndDate).toISOString()
      : null,
    registrationEndTime: program.registrationEndTime,
  };

  const serializedInstances = serializeInstances(
    program.instances,
    program.capacity,
    instanceCounts
  );

  const preSelectedInstanceIds = preSelectedInstanceParam
    ? preSelectedInstanceParam.split(",").filter(Boolean)
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-4 md:px-8 py-12">
        <Link
          href={`/programs/${programId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {program.name}
        </Link>

        {canRegister ? (
          <ProgramRegistrationFlow
            program={serializedProgram}
            instances={serializedInstances}
            slug={subdomain}
            primaryColor={primaryColor}
            earlyAccessCode={earlyAccessCode}
            preSelectedInstanceIds={preSelectedInstanceIds}
          />
        ) : registrationStatus === "closed" ? (
          <div className="rounded-lg border bg-muted/30 p-8 text-center">
            <Ban className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Registration Closed</h3>
            <p className="text-muted-foreground">Registration for this program has closed.</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-8 text-center">
            <Hourglass className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Registration Not Yet Open</h3>
            <p className="text-muted-foreground">
              {program.registrationStartDate
                ? `Registration opens on ${format(new Date(program.registrationStartDate), "MMMM d, yyyy")}${program.registrationStartTime ? ` at ${program.registrationStartTime}` : ""}.`
                : "Registration will open soon."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
