"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Settings,
  User,
  Users,
} from "lucide-react";

interface OrgConnection {
  type: "member" | "athlete";
  detail: string;
}

interface Organization {
  id: string;
  name: string;
  logo: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  stateProvince: string | null;
  siteUrl: string;
  dashboardUrl: string | null;
  connections: OrgConnection[];
}

export default function MyOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/athletes/my-organizations");
        if (!res.ok) return;
        const data = await res.json();
        setOrganizations(data.organizations || []);
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Organizations</h1>
        <Badge variant="secondary">
          {organizations.length}{" "}
          {organizations.length === 1 ? "organization" : "organizations"}
        </Badge>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold text-lg mb-1">No organizations</h3>
            <p className="text-sm text-muted-foreground">
              Organizations that you or your athletes are connected to will
              appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {organizations.map((org) => (
            <Card key={org.id} className="transition-colors hover:bg-muted/50">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <a
                    href={org.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <Avatar className="h-12 w-12 rounded-lg">
                      {org.logo && (
                        <AvatarImage src={org.logo} alt={org.name} />
                      )}
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                  </a>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a
                          href={org.siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1.5"
                        >
                          <h3 className="font-semibold text-base group-hover:underline">
                            {org.name}
                          </h3>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>

                        {(org.city ||
                          org.stateProvince ||
                          org.email ||
                          org.phone) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            {(org.city || org.stateProvince) && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {[org.city, org.stateProvince]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            )}
                            {org.email && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {org.email}
                              </span>
                            )}
                            {org.phone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {org.phone}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {org.dashboardUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="shrink-0"
                        >
                          <a href={org.dashboardUrl}>
                            <Settings className="h-3.5 w-3.5 mr-1.5" />
                            Dashboard
                          </a>
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {org.connections.map((conn, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {conn.type === "member" ? (
                            <Users className="h-3 w-3 mr-1" />
                          ) : (
                            <User className="h-3 w-3 mr-1" />
                          )}
                          {conn.type === "member"
                            ? `Member \u2013 ${conn.detail}`
                            : `Athlete \u2013 ${conn.detail}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
