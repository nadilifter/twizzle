import React from "react"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, CalendarDays, MapPin, Clock } from "lucide-react"

export default async function CompetitionsPage({ params }: { params: { slug: string } }) {
  const config = await db.websiteConfig.findUnique({
    where: { subdomain: params.slug },
    include: { organization: true },
  })

  if (!config || !config.showCompetitions) return notFound()

  const heading = config.competitionsHeading || "Competitions"
  const description = config.competitionsDescription || "Browse our upcoming competitions and register today."
  const ctaText = config.competitionsCtaText || "Register Now"
  const primaryColor = config.primaryColor || "#000000"

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section
        className="relative py-16 text-white"
        style={{
          background: `linear-gradient(to bottom right, ${primaryColor}, ${primaryColor}e6, ${primaryColor}cc)`,
        }}
      >
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-8 w-8" />
            <h1 className="text-4xl font-bold tracking-tight">{heading}</h1>
          </div>
          <p className="text-lg text-white/80 max-w-2xl">{description}</p>
        </div>
      </section>

      {/* Competitions List */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8">
        {/* Placeholder - no competitions data model yet */}
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
      </section>
    </div>
  )
}
