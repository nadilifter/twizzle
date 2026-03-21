import React from "react";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import { sanitizeHtml } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, MapPin, Trophy } from "lucide-react";
import { FilterableProgramList } from "@/components/sites/filterable-program-list";
import { InfoSection } from "@/components/sites/info-section";

// Helper to check if HTML content has actual text (not just empty tags)
function hasContent(html: string | null | undefined): boolean {
  if (!html) return false;
  // Strip HTML tags and check if there's any text content
  const textContent = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return textContent.length > 0;
}

export default async function SitePage({ params }: { params: { slug: string } }) {
  const config = await db.websiteConfig.findUnique({
    where: { subdomain: params.slug },
    include: { organization: true },
  });

  if (!config) return notFound();

  const primaryColor = config.primaryColor || "#000000";

  // Fetch active programs and levels for this organization
  const [programs, levels] = await Promise.all([
    db.program.findMany({
      where: {
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
        _count: {
          select: {
            instances: true,
            enrollments: { where: { status: { not: "WAITLISTED" } } },
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
      where: { organizationId: config.organizationId },
      select: { id: true, name: true, color: true },
      orderBy: { order: "asc" },
    }),
  ]);

  // Fetch waitlisted enrollment counts for programs with waitlists enabled
  const waitlistPrograms = programs.filter(p => p.waitlistEnabled);
  const waitlistedCounts = waitlistPrograms.length > 0
    ? await db.enrollment.groupBy({
        by: ["programId"],
        where: {
          programId: { in: waitlistPrograms.map(p => p.id) },
          status: "WAITLISTED",
        },
        _count: true,
      })
    : [];
  const waitlistCountMap = new Map(waitlistedCounts.map(w => [w.programId, w._count]));

  const enrichedPrograms = programs.map(p => ({
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
        className="relative py-20 text-white"
        style={{
          background: `linear-gradient(to bottom right, ${primaryColor}, ${primaryColor}e6, ${primaryColor}cc)`,
        }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="secondary"
              className="mb-6 bg-white/20 text-white backdrop-blur-sm border-white/20"
            >
              <Trophy className="mr-1.5 h-3.5 w-3.5" />
              Registration Now Open
            </Badge>

            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {config.heroHeadline && (
                <>
                  {config.heroHeadline}
                </>
              )}
              <span 
                className={config.heroHeadline ? "block mt-2" : ""}
                style={{ 
                  color: config.secondaryColor && config.secondaryColor !== "#ffffff" 
                    ? config.secondaryColor 
                    : "rgba(255,255,255,0.9)" 
                }}
              >
                {config.organization.name}
              </span>
            </h1>

            {config.heroSubheadline && (
              <p className="mb-8 text-lg text-white/80 sm:text-xl">
                {config.heroSubheadline}
              </p>
            )}

            {(config.heroAgeRange || config.heroProgramPeriods || config.heroLocation) && (
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
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
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="gap-2 text-base"
                >
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
              <Image 
                src={config.heroImage} 
                alt={`${config.organization.name} featured image`}
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-105"
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
              Programs & Registration
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Select a program below to begin your registration. Membership includes access to 
              facilities, equipment, and participation in all scheduled activities.
            </p>
          </div>

          <FilterableProgramList
            programs={enrichedPrograms.map(program => ({
              ...program,
              basePrice: program.basePrice ? Number(program.basePrice) : null,
              perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : null,
              staffAssignments: program.staffAssignments.map(sa => ({
                id: sa.id,
                role: sa.role,
                isPrimary: sa.isPrimary,
                member: {
                  id: sa.member.id,
                  title: sa.member.title,
                  user: sa.member.user,
                },
              })),
              requiredMemberships: program.requiredMemberships.map(m => ({
                ...m,
                price: Number(m.price),
              })),
              requiredPasses: (program.requiredPasses || []).map(p => ({
                ...p,
                price: Number(p.price),
              })),
              bulkDiscounts: (program as any).bulkDiscounts?.map((d: any) => ({
                ...d,
                discountValue: Number(d.discountValue),
              })) || [],
            }))}
            levels={levels}
            slug={params.slug}
            primaryColor={primaryColor}
          />
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
