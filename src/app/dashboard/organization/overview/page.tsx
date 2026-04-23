"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Calendar,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Check,
  Phone,
  Trophy,
  Users,
  BookOpen,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { OrganizationAddressForm } from "@/components/organization-address-form";
import { LocationMap } from "@/components/location-map";
import { getCountryName } from "@/lib/location-data";
import { cn } from "@/lib/utils";

interface FacilityLocation {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  street: string | null;
  city: string | null;
  stateProvince: string | null;
}

interface OrgDetails {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  _count: {
    members: number;
    organizationAthletes: number;
    programs: number;
  };
  subscription: {
    status: string;
    nextBillingDate: string | null;
    plan: {
      name: string;
    };
  } | null;
  sports: {
    sport: Sport;
  }[];
  facilities: FacilityLocation[];
}

interface Sport {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-0 py-2.5">
      <dt className="text-sm text-muted-foreground sm:w-36 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

function formatLongDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatCard({
  href,
  label,
  value,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="group">
      <Card className="transition-colors group-hover:border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function formatAddress(org: OrgDetails): string {
  const cityStateZip = [[org.city, org.stateProvince].filter(Boolean).join(", "), org.postalCode]
    .filter(Boolean)
    .join(" ");

  return [org.street, cityStateZip, org.country ? getCountryName(org.country) : null]
    .filter(Boolean)
    .join(", ");
}

export default function OrganizationOverviewPage() {
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [selectedSportIds, setSelectedSportIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSports, setSavingSports] = useState(false);
  const [sportsChanged, setSportsChanged] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [orgRes, sportsRes, allSportsRes] = await Promise.all([
        fetch("/api/organization/details"),
        fetch("/api/organization/sports"),
        fetch("/api/sports"),
      ]);

      if (orgRes.ok) {
        const org = await orgRes.json();
        setOrgDetails(org);
      }

      if (sportsRes.ok) {
        const orgSports: Sport[] = await sportsRes.json();
        setSelectedSportIds(orgSports.map((s) => s.id));
      }

      if (allSportsRes.ok) {
        const sports: Sport[] = await allSportsRes.json();
        setAllSports(sports);
      }
    } catch (error) {
      toast.error("Failed to load organization details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSportToggle = (sportId: string, checked: boolean) => {
    setSelectedSportIds((prev) => {
      const updated = checked ? [...prev, sportId] : prev.filter((id) => id !== sportId);
      return updated;
    });
    setSportsChanged(true);
  };

  const handleSaveSports = async () => {
    setSavingSports(true);
    try {
      const response = await fetch("/api/organization/sports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sportIds: selectedSportIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update sports");
      }

      const updatedSports: Sport[] = await response.json();
      setSelectedSportIds(updatedSports.map((s) => s.id));
      setSportsChanged(false);
      toast.success("Sports updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update sports");
    } finally {
      setSavingSports(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!orgDetails) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Unable to load organization details.</p>
      </div>
    );
  }

  const hasAddress =
    orgDetails.street || orgDetails.city || orgDetails.stateProvince || orgDetails.postalCode;

  const firstFacility = orgDetails.facilities.find(
    (f) => f.latitude != null && f.longitude != null
  );

  const mapLocation = firstFacility
    ? {
        latitude: firstFacility.latitude!,
        longitude: firstFacility.longitude!,
        label: firstFacility.name,
        sublabel: [firstFacility.street, firstFacility.city, firstFacility.stateProvince]
          .filter(Boolean)
          .join(", "),
      }
    : orgDetails.latitude != null && orgDetails.longitude != null
      ? {
          latitude: orgDetails.latitude,
          longitude: orgDetails.longitude,
          label: orgDetails.name,
          sublabel: hasAddress ? formatAddress(orgDetails) : undefined,
        }
      : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header with org identity */}
      <DashboardPageHeader
        title={
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <span>{orgDetails.name}</span>
              <p className="text-sm font-normal text-muted-foreground font-mono">
                {orgDetails.slug}
              </p>
            </div>
          </div>
        }
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          href="/dashboard/organization/staff"
          label="Staff"
          value={orgDetails._count.members}
          description="Active team members"
          icon={Users}
        />
        <StatCard
          href="/dashboard/athletes"
          label="Athletes"
          value={orgDetails._count.organizationAthletes}
          description="Registered athletes"
          icon={Users}
        />
        <StatCard
          href="/dashboard/registrations/programs"
          label="Programs"
          value={orgDetails._count.programs}
          description="Active programs"
          icon={BookOpen}
        />
      </div>

      {/* Contact Info + Location + Subscription */}
      <div className={cn("grid gap-4", mapLocation ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Contact Information</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditSheetOpen(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1">
              {orgDetails.email && (
                <DetailRow label="Email">
                  <span className="flex min-w-0 items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate" title={orgDetails.email}>
                      {orgDetails.email}
                    </span>
                  </span>
                </DetailRow>
              )}
              {orgDetails.phone && (
                <DetailRow label="Phone">
                  <span className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatPhoneNumberIntl(orgDetails.phone) || orgDetails.phone}
                  </span>
                </DetailRow>
              )}
              {hasAddress && (
                <DetailRow label="Address">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatAddress(orgDetails)}
                  </span>
                </DetailRow>
              )}
              {!orgDetails.email && !orgDetails.phone && !hasAddress && (
                <p className="py-3 text-sm text-muted-foreground">
                  No contact information set.{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setEditSheetOpen(true)}
                  >
                    Add contact info
                  </button>
                </p>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Location Map — only rendered when we have coordinates */}
        {mapLocation && (
          <Card className="overflow-hidden">
            <LocationMap
              latitude={mapLocation.latitude}
              longitude={mapLocation.longitude}
              label={mapLocation.label}
              sublabel={mapLocation.sublabel}
              className="h-full min-h-[100px]"
            />
          </Card>
        )}

        {/* Subscription & Membership */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1">
              {orgDetails.subscription && (
                <DetailRow label="Plan">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    {orgDetails.subscription.plan.name}
                    <Badge
                      variant={
                        orgDetails.subscription.status === "ACTIVE"
                          ? "default"
                          : orgDetails.subscription.status === "TRIALING"
                            ? "secondary"
                            : "destructive"
                      }
                      className="text-xs"
                    >
                      {orgDetails.subscription.status}
                    </Badge>
                  </span>
                </DetailRow>
              )}
              {orgDetails.subscription?.nextBillingDate && (
                <DetailRow label="Next billing">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatLongDate(orgDetails.subscription.nextBillingDate)}
                  </span>
                </DetailRow>
              )}
              <DetailRow label="Member since">
                <span className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatLongDate(orgDetails.createdAt)}
                </span>
              </DetailRow>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Sports Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle>Sports Offered</CardTitle>
            </div>
            {sportsChanged && (
              <Button onClick={handleSaveSports} disabled={savingSports} size="sm">
                {savingSports ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            )}
          </div>
          <CardDescription>
            Select the sports your organization offers. This helps tailor the platform experience
            for your needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allSports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sports have been configured by the platform yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allSports.map((sport) => {
                const isSelected = selectedSportIds.includes(sport.id);
                return (
                  <label
                    key={sport.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSportToggle(sport.id, !!checked)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 space-y-0.5">
                      <span className="font-medium text-sm">{sport.name}</span>
                      {sport.description && (
                        <p className="text-xs text-muted-foreground">{sport.description}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Contact Info Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Contact Information</SheetTitle>
            <SheetDescription>
              Update your organization&apos;s contact details and address.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <OrganizationAddressForm
              organization={orgDetails}
              onSuccess={(updated) => {
                setOrgDetails((prev) => (prev ? { ...prev, ...updated } : null));
                setEditSheetOpen(false);
              }}
              onCancel={() => setEditSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
