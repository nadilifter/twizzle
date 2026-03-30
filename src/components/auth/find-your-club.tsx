"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UplifterLogo } from "@/components/uplifter-logo";
import { ShineBorder } from "@/components/ui/shine-border";
import { ArrowLeft, MapPin, Search, Building2 } from "lucide-react";
import { getClientSubdomainUrl } from "@/lib/client-domains";

type Organization = {
  id: string;
  name: string;
  logo: string | null;
  city: string | null;
  stateProvince: string | null;
  sports: { sport: { id: string; name: string; slug: string } }[];
  websiteConfig: {
    subdomain: string | null;
    logo: string | null;
    heroLocation: string | null;
    primaryColor: string | null;
  } | null;
};

type Sport = {
  id: string;
  name: string;
  slug: string;
};

export function FindYourClub({
  organizations,
  sports,
}: {
  organizations: Organization[];
  sports: Sport[];
}) {
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const sportsWithOrgs = sports.filter((sport) =>
    organizations.some((org) => org.sports.some((os) => os.sport.id === sport.id))
  );

  const filtered = organizations.filter((org) => {
    const matchesSport = !selectedSport || org.sports.some((os) => os.sport.id === selectedSport);
    const matchesSearch =
      !search ||
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.city?.toLowerCase().includes(search.toLowerCase()) ||
      org.stateProvince?.toLowerCase().includes(search.toLowerCase());
    return matchesSport && matchesSearch;
  });

  return (
    <div className="w-full max-w-4xl">
      <Card className="relative overflow-hidden">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} />
        <div className="p-6 pb-4 flex flex-col items-center gap-4">
          <UplifterLogo width={180} height={36} className="h-9" />
          <h1 className="text-2xl font-bold">Find your club</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Pick a sport to browse clubs, or search by name or location.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <Button
              variant={selectedSport === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSport(null)}
              className="rounded-full"
            >
              All
            </Button>
            {sportsWithOrgs.map((sport) => (
              <Button
                key={sport.id}
                variant={selectedSport === sport.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSport(selectedSport === sport.id ? null : sport.id)}
                className="rounded-full"
              >
                {sport.name}
              </Button>
            ))}
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Building2 className="h-10 w-10" />
              <p className="text-sm">No clubs found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((org) => {
                const subdomain = org.websiteConfig?.subdomain;
                const href = subdomain ? getClientSubdomainUrl(subdomain) : "#";
                const logo = org.websiteConfig?.logo || org.logo;
                const location =
                  org.websiteConfig?.heroLocation ||
                  [org.city, org.stateProvince].filter(Boolean).join(", ");

                return (
                  <a key={org.id} href={href} className="group block text-left">
                    <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          {logo ? (
                            <img
                              src={logo}
                              alt={org.name}
                              className="h-10 w-10 rounded-md object-contain shrink-0 bg-muted p-0.5"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-sm font-bold text-primary">
                                {org.name
                                  .split(" ")
                                  .map((w) => w[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
                              {org.name}
                            </h3>
                            {location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{location}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        {org.sports.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {org.sports.map((os) => (
                              <Badge
                                key={os.sport.id}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {os.sport.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to login
        </Link>
      </div>
    </div>
  );
}
