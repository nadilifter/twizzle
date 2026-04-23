"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface LatestRegistrationItem {
  id: string;
  athleteId: string;
  athleteName: string;
  athleteAvatar: string | null;
  registeredAt: string;
  subtitle?: string;
}

interface LatestRegistrationsCardProps {
  registrations: LatestRegistrationItem[];
  drillInHref: (athleteId: string) => string;
  onViewAll?: () => void;
  limit?: number;
  emptyLabel?: string;
}

export function LatestRegistrationsCard({
  registrations,
  drillInHref,
  onViewAll,
  limit = 5,
  emptyLabel = "No athletes registered yet.",
}: LatestRegistrationsCardProps) {
  const items = registrations.slice(0, limit);
  const hasMore = registrations.length > limit;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Latest Registrations</CardTitle>
        {hasMore && onViewAll && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={onViewAll}>
            View All
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((reg) => (
              <div key={reg.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={reg.athleteAvatar || undefined} alt={reg.athleteName} />
                    <AvatarFallback>
                      {reg.athleteName
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{reg.athleteName}</p>
                    <p className="text-xs text-muted-foreground">
                      {reg.subtitle ?? format(new Date(reg.registeredAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={drillInHref(reg.athleteId)}>View</Link>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground">{emptyLabel}</div>
        )}
      </CardContent>
    </Card>
  );
}
