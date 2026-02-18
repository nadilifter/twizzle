"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  CalendarDays,
  MapPin,
  Users,
  UserCheck,
  Shield,
  Tag,
} from "lucide-react";

interface CompetitionCardProps {
  competition: {
    id: string;
    name: string;
    competitionType: string;
    startDate: string | Date;
    endDate: string | Date;
    startTime: string;
    endTime: string;
    city?: string | null;
    stateProvince?: string | null;
    facility?: { id: string; name: string; city?: string | null; stateProvince?: string | null } | null;
    pricingMode: string;
    entryFee?: number | string | null;
    hasAgeRestriction?: boolean;
    minAge?: number | null;
    maxAge?: number | null;
    hasLevelRestriction?: boolean;
    hasCapacityRestriction?: boolean;
    capacity?: number | null;
    hasMembershipRestriction?: boolean;
    _count?: {
      categories?: number;
      entries?: number;
    };
    pricingTiers?: {
      id: string;
      minEvents: number;
      maxEvents: number | null;
      pricePerEvent: number | string;
    }[];
  };
  primaryColor?: string;
}

function formatPrice(price: number | string): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (numPrice === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numPrice);
}

function getPricingSummary(competition: CompetitionCardProps["competition"]): string {
  switch (competition.pricingMode) {
    case "FREE":
      return "Free Entry";
    case "PER_COMPETITION": {
      const fee = competition.entryFee
        ? typeof competition.entryFee === "string"
          ? parseFloat(competition.entryFee)
          : competition.entryFee
        : 0;
      return fee === 0 ? "Free Entry" : `${formatPrice(fee)} entry fee`;
    }
    case "PER_EVENT": {
      const fee = competition.entryFee
        ? typeof competition.entryFee === "string"
          ? parseFloat(competition.entryFee)
          : competition.entryFee
        : 0;
      return fee === 0 ? "Free Entry" : `${formatPrice(fee)}/event`;
    }
    case "TIERED": {
      const tiers = competition.pricingTiers || [];
      if (tiers.length === 0) return "Tiered Pricing";
      const minPrice = Math.min(
        ...tiers.map((t) =>
          typeof t.pricePerEvent === "string" ? parseFloat(t.pricePerEvent) : t.pricePerEvent
        )
      );
      const maxPrice = Math.max(
        ...tiers.map((t) =>
          typeof t.pricePerEvent === "string" ? parseFloat(t.pricePerEvent) : t.pricePerEvent
        )
      );
      if (minPrice === maxPrice) return `${formatPrice(minPrice)}/event`;
      return `${formatPrice(minPrice)}–${formatPrice(maxPrice)}/event`;
    }
    case "PER_CATEGORY":
      return "Priced per category";
    default:
      return "";
  }
}

export function CompetitionCard({ competition, primaryColor }: CompetitionCardProps) {
  const startDate = new Date(competition.startDate);
  const endDate = new Date(competition.endDate);
  const sameDay = format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");

  const locationLabel = competition.facility
    ? `${competition.facility.name}${competition.facility.city ? `, ${competition.facility.city}` : ""}`
    : [competition.city, competition.stateProvince].filter(Boolean).join(", ") || null;

  const ageLabel =
    competition.hasAgeRestriction && (competition.minAge != null || competition.maxAge != null)
      ? competition.minAge != null && competition.maxAge != null
        ? `Ages ${competition.minAge}–${competition.maxAge}`
        : competition.minAge != null
        ? `Ages ${competition.minAge}+`
        : `Up to age ${competition.maxAge}`
      : null;

  const totalCapacity = competition.capacity || 0;
  const totalEntries = competition._count?.entries || 0;
  const spotsAvailable =
    competition.hasCapacityRestriction && totalCapacity > 0
      ? Math.max(0, totalCapacity - totalEntries)
      : null;

  const categoryCount = competition._count?.categories || 0;
  const pricingSummary = getPricingSummary(competition);

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
              {competition.name}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {spotsAvailable !== null && spotsAvailable <= 10 && spotsAvailable > 0 && (
              <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">
                {spotsAvailable} spot{spotsAvailable !== 1 ? "s" : ""} left
              </Badge>
            )}
            {spotsAvailable === 0 && (
              <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">
                Full
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span>
              {sameDay
                ? format(startDate, "EEEE, MMM d, yyyy")
                : `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`}
            </span>
          </div>

          {competition.startTime && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-0" />
              <span>
                {competition.startTime}
                {competition.endTime ? ` – ${competition.endTime}` : ""}
              </span>
            </div>
          )}

          {locationLabel && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{locationLabel}</span>
            </div>
          )}

          {categoryCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="h-3.5 w-3.5 shrink-0" />
              <span>
                {categoryCount} event{categoryCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {(ageLabel || (competition.hasCapacityRestriction && totalCapacity > 0) || competition.hasMembershipRestriction) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ageLabel && (
              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">
                <UserCheck className="h-3 w-3" />
                {ageLabel}
              </div>
            )}
            {competition.hasCapacityRestriction && totalCapacity > 0 && (
              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-full">
                <Users className="h-3 w-3" />
                {spotsAvailable !== null ? `${spotsAvailable}/${totalCapacity} spots` : `${totalCapacity} spots`}
              </div>
            )}
            {competition.hasMembershipRestriction && (
              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                <Shield className="h-3 w-3" />
                Membership Required
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t bg-muted/30 pt-4">
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-medium">{pricingSummary}</span>
        </div>

        <Button
          asChild
          disabled={spotsAvailable === 0}
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95"
        >
          <Link href={`/competitions/${competition.id}`}>
            <Trophy className="h-4 w-4" />
            {spotsAvailable === 0 ? "Currently Full" : "Register"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
