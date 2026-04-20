import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getCacheVersion } from "@/lib/cache-version";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { QueueGateWrapper } from "@/components/sites/queue-gate-wrapper";
import { FilterableProgramList } from "@/components/sites/filterable-program-list";

const getCachedRegisterCategories = unstable_cache(
  async (organizationId: string) => {
    return db.category.findMany({
      where: { organizationId },
      select: { id: true, name: true, description: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  },
  ["site-categories-register"],
  { revalidate: 30 }
);

const getCachedRegisterConfig = unstable_cache(
  async (subdomain: string) => {
    return db.websiteConfig.findUnique({
      where: { subdomain },
      select: { organizationId: true, primaryColor: true },
    });
  },
  ["site-config-register"],
  { revalidate: 30 }
);

const getCachedRegisterPrograms = unstable_cache(
  async (organizationId: string, _version: number) => {
    const [programs, levels] = await Promise.all([
      db.program.findMany({
        where: { organizationId, status: "ACTIVE" },
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
          _count: {
            select: {
              instances: true,
              enrollments: { where: { status: { not: "WAITLISTED" } } },
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
            take: 3,
          },
          requiredMemberships: {
            include: {
              group: { select: { id: true, name: true } },
            },
          },
        },
      }),
      db.level.findMany({
        where: { organizationId },
        select: { id: true, name: true, color: true },
        orderBy: { order: "asc" },
      }),
    ]);

    const waitlistPrograms = programs.filter((p) => p.waitlistEnabled);
    const waitlistedCounts =
      waitlistPrograms.length > 0
        ? await db.enrollment.groupBy({
            by: ["programId"],
            where: {
              programId: { in: waitlistPrograms.map((p) => p.id) },
              status: "WAITLISTED",
            },
            _count: true,
          })
        : [];

    return { programs, levels, waitlistedCounts };
  },
  ["site-programs-register"],
  { revalidate: 3600 }
);

const getCachedSeasons = unstable_cache(
  async (organizationId: string) => {
    return db.season.findMany({
      where: { organizationId, status: { in: ["ACTIVE", "DRAFT"] } },
      select: { id: true, name: true, color: true },
      orderBy: { startDate: "desc" },
    });
  },
  ["site-seasons-register"],
  { revalidate: 30 }
);

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { coach?: string; category?: string };
}) {
  const subdomain = params.slug;

  const config = await getCachedRegisterConfig(subdomain);

  if (!config) return notFound();

  const programsVersion = await getCacheVersion(config.organizationId, "programs");

  const [
    { programs, levels, waitlistedCounts },
    seasonsEnabled,
    trainingEnabled,
    registerCategories,
  ] = await Promise.all([
    getCachedRegisterPrograms(config.organizationId, programsVersion),
    isFeatureEnabled(config.organizationId, "seasons"),
    isFeatureEnabled(config.organizationId, "training"),
    getCachedRegisterCategories(config.organizationId),
  ]);

  const seasons = seasonsEnabled ? await getCachedSeasons(config.organizationId) : [];
  const waitlistCountMap = new Map(waitlistedCounts.map((w) => [w.programId, w._count]));

  const serializedPrograms = programs.map((program) => ({
    ...program,
    basePrice: program.basePrice ? Number(program.basePrice) : null,
    perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : null,
    recurringPrice: program.recurringPrice ? Number(program.recurringPrice) : null,
    _count: {
      ...program._count,
      waitlistedEnrollments: waitlistCountMap.get(program.id) || 0,
    },
    bulkDiscounts: program.bulkDiscounts.map((discount) => ({
      ...discount,
      discountValue: Number(discount.discountValue),
    })),
    staffAssignments: program.staffAssignments.map((assignment) => ({
      id: assignment.id,
      role: assignment.role,
      isPrimary: assignment.isPrimary,
      member: {
        id: assignment.member.id,
        title: assignment.member.title,
        user: assignment.member.user,
      },
    })),
    requiredMemberships: program.requiredMemberships.map((membership) => ({
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
          Browse our available programs and find the perfect fit for you. Register online to secure
          your spot today.
        </p>

        <FilterableProgramList
          programs={serializedPrograms}
          levels={trainingEnabled ? levels : []}
          seasons={seasons}
          slug={subdomain}
          primaryColor={config.primaryColor || undefined}
          initialCoachId={searchParams.coach}
          categories={registerCategories}
          initialCategoryId={searchParams.category}
        />
      </div>
    </QueueGateWrapper>
  );
}
