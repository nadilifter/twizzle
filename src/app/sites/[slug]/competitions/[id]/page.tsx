import React from "react"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { Trophy, CalendarDays, MapPin, Clock } from "lucide-react"
import { CompetitionRegistrationFlow } from "@/components/sites/competition-registration-flow"

export default async function CompetitionDetailPage({
  params,
}: {
  params: { slug: string; id: string }
}) {
  const config = await db.websiteConfig.findUnique({
    where: { subdomain: params.slug },
    include: { organization: true },
  })

  if (!config || !config.showCompetitions) return notFound()

  const competition = await db.competition.findUnique({
    where: { id: params.id },
    include: {
      facility: {
        select: { id: true, name: true, city: true, stateProvince: true },
      },
      categories: {
        where: { isActive: true },
        include: {
          sportEvent: {
            select: { id: true, name: true, code: true, eventGroup: true },
          },
          ageCategory: {
            select: { id: true, name: true, code: true, minAge: true, maxAge: true },
          },
        },
        orderBy: { displayOrder: "asc" },
      },
      pricingTiers: {
        orderBy: { displayOrder: "asc" },
      },
    },
  })

  if (
    !competition ||
    competition.organizationId !== config.organizationId ||
    competition.publishStatus !== "LIVE"
  ) {
    return notFound()
  }

  const primaryColor = config.primaryColor || "#000000"

  const startDate = new Date(competition.startDate)
  const endDate = new Date(competition.endDate)
  const sameDay =
    format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd")

  const locationLabel = competition.facility
    ? `${competition.facility.name}${competition.facility.city ? `, ${competition.facility.city}` : ""}`
    : [competition.city, competition.stateProvince].filter(Boolean).join(", ") || null

  // Serialize for client component
  const serializedCompetition = {
    id: competition.id,
    name: competition.name,
    competitionType: competition.competitionType,
    startDate: competition.startDate.toISOString(),
    endDate: competition.endDate.toISOString(),
    startTime: competition.startTime,
    endTime: competition.endTime,
    city: competition.city,
    stateProvince: competition.stateProvince,
    facility: competition.facility,
    pricingMode: competition.pricingMode,
    entryFee: competition.entryFee ? Number(competition.entryFee) : null,
    hasAgeRestriction: competition.hasAgeRestriction,
    minAge: competition.minAge,
    maxAge: competition.maxAge,
    hasLevelRestriction: competition.hasLevelRestriction,
    levelRequirementIds: competition.levelRequirementIds,
    hasCapacityRestriction: competition.hasCapacityRestriction,
    capacity: competition.capacity,
    hasMembershipRestriction: competition.hasMembershipRestriction,
    membershipRequirementIds: competition.membershipRequirementIds,
    hasWaiverRestriction: competition.hasWaiverRestriction,
    waiverRequirementIds: competition.waiverRequirementIds,
    hasMedicalRequirement: competition.hasMedicalRequirement,
    organizationId: competition.organizationId,
    categories: competition.categories.map((cat) => ({
      id: cat.id,
      sportEvent: cat.sportEvent
        ? {
            id: cat.sportEvent.id,
            name: cat.sportEvent.name,
            code: cat.sportEvent.code,
            eventGroup: cat.sportEvent.eventGroup,
          }
        : null,
      ageCategory: cat.ageCategory
        ? {
            id: cat.ageCategory.id,
            name: cat.ageCategory.name,
            code: cat.ageCategory.code,
            minAge: cat.ageCategory.minAge,
            maxAge: cat.ageCategory.maxAge,
          }
        : null,
      isTeamEvent: cat.isTeamEvent,
      price: cat.price ? Number(cat.price) : null,
      displayOrder: cat.displayOrder,
      seedMarkRequired: cat.seedMarkRequired,
      submissionMode: cat.submissionMode,
      resultType: cat.resultType,
      precision: cat.precision,
      qualifyingMark: cat.qualifyingMark ? Number(cat.qualifyingMark) : null,
    })),
    pricingTiers: competition.pricingTiers.map((t) => ({
      id: t.id,
      minEvents: t.minEvents,
      maxEvents: t.maxEvents,
      pricePerEvent: Number(t.pricePerEvent),
      displayOrder: t.displayOrder,
    })),
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative py-16 text-white"
        style={{
          background: `linear-gradient(to bottom right, ${primaryColor}, ${primaryColor}e6, ${primaryColor}cc)`,
        }}
      >
        <div className="mx-auto w-full max-w-4xl px-4 md:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-8 w-8" />
            <h1 className="text-4xl font-bold tracking-tight">
              {competition.name}
            </h1>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-white/80">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              <span>
                {sameDay
                  ? format(startDate, "EEEE, MMMM d, yyyy")
                  : `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`}
              </span>
            </div>

            {competition.startTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>
                  {competition.startTime}
                  {competition.endTime ? ` – ${competition.endTime}` : ""}
                </span>
              </div>
            )}

            {locationLabel && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{locationLabel}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Registration Flow */}
      <section className="mx-auto w-full max-w-4xl px-4 py-12 md:px-8">
        <CompetitionRegistrationFlow
          competition={serializedCompetition}
          slug={params.slug}
          primaryColor={primaryColor}
        />
      </section>
    </div>
  )
}
