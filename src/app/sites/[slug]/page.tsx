import React from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getCacheVersion } from "@/lib/cache-version";
import { notFound } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitize";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MapPin } from "lucide-react";
import { FilterableProgramList } from "@/components/sites/filterable-program-list";
import { CategoryTiles } from "@/components/sites/category-tiles";
import { InfoSection } from "@/components/sites/info-section";
import { getHeroContrastStyles } from "@/lib/color-utils";
import { getRegistrationStatus } from "@/lib/registration-utils";
import { ShineBorder } from "@/components/ui/shine-border";

function hasContent(html: string | null | undefined): boolean {
  if (!html) return false;
  const textContent = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return textContent.length > 0;
}

const getCachedSiteConfig = unstable_cache(
  async (slug: string) => {
    return db.websiteConfig.findUnique({
      where: { subdomain: slug },
      include: { organization: true },
    });
  },
  ["site-config"],
  { revalidate: 30 }
);

const getCachedHomePrograms = unstable_cache(
  async (organizationId: string, _version: number) => {
    const [programs, levels] = await Promise.all([
      db.program.findMany({
        where: { organizationId, status: "ACTIVE", registrationStatus: "OPEN" },
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
              enrollments: { where: { status: { in: ["ACTIVE", "WAITLIST_PAYMENT_PENDING"] } } },
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
          requiredPasses: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              name: true,
              price: true,
              billingInterval: true,
              sessionLimit: true,
              limitPeriod: true,
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
  ["site-programs-home"],
  { revalidate: 60 }
);

const getCachedSeasons = unstable_cache(
  async (organizationId: string) => {
    return db.season.findMany({
      where: { organizationId, status: { in: ["ACTIVE", "DRAFT"] } },
      select: { id: true, name: true, color: true },
      orderBy: { startDate: "desc" },
    });
  },
  ["site-seasons-home"],
  { revalidate: 30 }
);

const getCachedCategories = unstable_cache(
  async (organizationId: string) => {
    return db.category.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            programs: { where: { status: "ACTIVE" } },
            events: true,
            competitions: true,
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  },
  ["site-categories-home"],
  { revalidate: 30 }
);

export default async function SitePage({ params }: { params: { slug: string } }) {
  const config = await getCachedSiteConfig(params.slug);

  if (!config) return notFound();

  const primaryColor = config.primaryColor || "#000000";
  const hero = getHeroContrastStyles(primaryColor);

  const programsVersion = await getCacheVersion(config.organizationId, "programs");

  const [{ programs, levels, waitlistedCounts }, seasonsEnabled, trainingEnabled, siteCategories] =
    await Promise.all([
      getCachedHomePrograms(config.organizationId, programsVersion),
      isFeatureEnabled(config.organizationId, "seasons"),
      isFeatureEnabled(config.organizationId, "training"),
      getCachedCategories(config.organizationId),
    ]);

  const seasons = seasonsEnabled ? await getCachedSeasons(config.organizationId) : [];
  const waitlistCountMap = new Map(waitlistedCounts.map((w) => [w.programId, w._count]));
  const populatedCategories = siteCategories.filter((c) => c._count.programs > 0);
  const hasCategories = populatedCategories.length > 0;

  const enrichedPrograms = programs.map((p) => ({
    ...p,
    _count: {
      ...p._count,
      waitlistedEnrollments: waitlistCountMap.get(p.id) || 0,
    },
  }));

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className={`relative py-20 ${hero.text}`}
        style={{
          background: `linear-gradient(to bottom right, ${primaryColor}, ${primaryColor}e6, ${primaryColor}cc)`,
        }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${hero.patternFill}' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            {config.showRegistration &&
              enrichedPrograms.some((p) => getRegistrationStatus(p) === "open") && (
                <div className="relative mb-6 inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-gray-900 shadow-lg shadow-emerald-900/20 dark:bg-gray-900 dark:text-white">
                  <ShineBorder
                    shineColor={["#10b981", "#34d399"]}
                    borderWidth={2}
                    className="rounded-full"
                    duration={25}
                    style={{ backgroundSize: "600% 600%" }}
                  />
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Registration Now Open
                </div>
              )}

            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {config.heroHeadline && <>{config.heroHeadline}</>}
              <span
                className={config.heroHeadline ? "block mt-2" : ""}
                style={{
                  color:
                    config.secondaryColor && config.secondaryColor !== "#ffffff"
                      ? config.secondaryColor
                      : hero.secondaryFallback,
                }}
              >
                {config.organization.name}
              </span>
            </h1>

            {config.heroSubheadline && (
              <p className={`mb-8 text-lg ${hero.textMuted} sm:text-xl`}>
                {config.heroSubheadline}
              </p>
            )}

            {(config.heroAgeRange || config.heroProgramPeriods || config.heroLocation) && (
              <div
                className={`flex flex-wrap items-center justify-center gap-4 text-sm ${hero.textSubtle}`}
              >
                {config.heroAgeRange && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>{config.heroAgeRange}</span>
                  </div>
                )}
                {config.heroProgramPeriods && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{config.heroProgramPeriods}</span>
                  </div>
                )}
                {config.heroLocation && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{config.heroLocation}</span>
                  </div>
                )}
              </div>
            )}

            {config.showRegistration && (
              <div className="mt-8">
                <Button asChild size="lg" variant="secondary" className="gap-2 text-base">
                  <a href="#programs">
                    View Programs
                    <span aria-hidden="true">↓</span>
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Hero Image / Featured Image */}
      {config.heroImage && (
        <section className="py-16 bg-background">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
            <div className="relative w-full aspect-video rounded-xl border bg-card/50 backdrop-blur shadow-2xl overflow-hidden ring-1 ring-black/5 group">
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent z-10 pointer-events-none" />
              <ProgressiveImage
                src={config.heroImage}
                alt={`${config.organization.name} featured image`}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 1280px) 100vw, 1280px"
                priority
              />
            </div>
          </div>
        </section>
      )}

      {/* Hero Text / Additional Content */}
      {hasContent(config.heroText) && (
        <section className="py-16 bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
            <div className="max-w-3xl mx-auto bg-card rounded-2xl p-8 md:p-12 shadow-sm border">
              <div
                className="prose prose-lg prose-slate mx-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(config.heroText!) }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Programs Section */}
      {config.showRegistration && (
        <section id="programs" className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">
              {hasCategories ? "Explore Our Programs" : "Programs & Registration"}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {hasCategories
                ? "Browse our program categories to find what's right for you."
                : "Select a program below to begin your registration. Membership includes access to facilities, equipment, and participation in all scheduled activities."}
            </p>
          </div>

          {hasCategories ? (
            <CategoryTiles
              categories={populatedCategories}
              primaryColor={primaryColor}
              allProgramsImageUrl={config.allProgramsCategoryImageUrl}
            />
          ) : (
            <FilterableProgramList
              programs={enrichedPrograms.map((program) => ({
                ...program,
                basePrice: program.basePrice ? Number(program.basePrice) : null,
                perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : null,
                recurringPrice: program.recurringPrice ? Number(program.recurringPrice) : null,
                staffAssignments: program.staffAssignments.map((sa) => ({
                  id: sa.id,
                  role: sa.role,
                  isPrimary: sa.isPrimary,
                  member: {
                    id: sa.member.id,
                    title: sa.member.title,
                    user: sa.member.user,
                  },
                })),
                requiredMemberships: program.requiredMemberships.map((m) => ({
                  ...m,
                  price: Number(m.price),
                })),
                requiredPasses: (program.requiredPasses || []).map((p) => ({
                  ...p,
                  price: Number(p.price),
                })),
                bulkDiscounts:
                  (program as any).bulkDiscounts?.map((d: any) => ({
                    ...d,
                    discountValue: Number(d.discountValue),
                  })) || [],
              }))}
              levels={trainingEnabled ? levels : []}
              seasons={seasons}
              slug={params.slug}
              primaryColor={primaryColor}
            />
          )}
        </section>
      )}

      {/* Info Section */}
      <InfoSection
        infoBox1Title={config.infoBox1Title}
        infoBox1Content={config.infoBox1Content}
        infoBox2Title={config.infoBox2Title}
        infoBox2Content={config.infoBox2Content}
        infoBox3Title={config.infoBox3Title}
        infoBox3Content={config.infoBox3Content}
      />
    </div>
  );
}
