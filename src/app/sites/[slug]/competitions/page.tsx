import React from "react"
import { unstable_cache } from "next/cache"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Trophy } from "lucide-react"
import { CompetitionCard } from "@/components/sites/competition-card"
import { getHeroContrastStyles } from "@/lib/color-utils"

const getCachedSiteConfig = unstable_cache(
  async (slug: string) => {
    return db.websiteConfig.findUnique({
      where: { subdomain: slug },
      include: { organization: true },
    })
  },
  ["site-config"],
  { revalidate: 30 }
)

const getCachedCompetitions = unstable_cache(
  async (organizationId: string) => {
    const competitions = await db.competition.findMany({
      where: { organizationId, publishStatus: "LIVE" },
      include: {
        facility: {
          select: { id: true, name: true, city: true, stateProvince: true },
        },
        pricingTiers: { orderBy: { displayOrder: "asc" } },
        _count: { select: { categories: true, entries: true } },
      },
      orderBy: { startDate: "asc" },
    })

    return competitions.map((c) => ({
      id: c.id,
      name: c.name,
      competitionType: c.competitionType,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      startTime: c.startTime,
      endTime: c.endTime,
      city: c.city,
      stateProvince: c.stateProvince,
      facility: c.facility,
      pricingMode: c.pricingMode,
      entryFee: c.entryFee ? Number(c.entryFee) : null,
      hasAgeRestriction: c.hasAgeRestriction,
      minAge: c.minAge,
      maxAge: c.maxAge,
      hasLevelRestriction: c.hasLevelRestriction,
      hasCapacityRestriction: c.hasCapacityRestriction,
      capacity: c.capacity,
      hasMembershipRestriction: c.hasMembershipRestriction,
      _count: c._count,
      pricingTiers: c.pricingTiers.map((t) => ({
        id: t.id,
        minEvents: t.minEvents,
        maxEvents: t.maxEvents,
        pricePerEvent: Number(t.pricePerEvent),
      })),
    }))
  },
  ["site-competitions"],
  { revalidate: 30 }
)

export default async function CompetitionsPage({ params }: { params: { slug: string } }) {
  const config = await getCachedSiteConfig(params.slug)

  if (!config || !config.showCompetitions) return notFound()

  const heading = config.competitionsHeading || "Competitions"
  const description = config.competitionsDescription || "Browse our upcoming competitions and register today."
  const primaryColor = config.primaryColor || "#000000"
  const hero = getHeroContrastStyles(primaryColor)

  const serialized = await getCachedCompetitions(config.organizationId)

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section
        className={`relative py-16 ${hero.text}`}
        style={{
          background: `linear-gradient(to bottom right, ${primaryColor}, ${primaryColor}e6, ${primaryColor}cc)`,
        }}
      >
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-8 w-8" />
            <h1 className="text-4xl font-bold tracking-tight">{heading}</h1>
          </div>
          <p className={`text-lg ${hero.textMuted} max-w-2xl`}>{description}</p>
        </div>
      </section>

      {/* Competitions List */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8">
        {serialized.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {serialized.map((competition) => (
              <CompetitionCard
                key={competition.id}
                competition={competition}
                primaryColor={primaryColor}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">
              No Competitions Available
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              There are no upcoming competitions at this time. Please check back later
              for new events and registration opportunities.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
