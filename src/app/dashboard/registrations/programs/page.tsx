"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sanitizeHtml } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  Settings,
  Loader2,
  AlertCircle,
  CalendarDays,
  CalendarClock,
  Clock,
  MapPin,
  Users,
  UserCheck,
  Shield,
  Repeat,
  Star,
  User,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePrograms } from "@/hooks/use-programs";
import { useSeasons } from "@/hooks/use-seasons";
import { useFeatures } from "@/components/feature-context";
import { formatRRuleDays } from "@/lib/rrule-utils";
import { ProgramConfiguration } from "./program-configuration";
import { getRegistrationStatus } from "@/lib/registration-utils";

function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return "Free";
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (numPrice === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numPrice);
}

export default function ProgramsPage() {
  const router = useRouter();
  const { programs, isLoading, error, fetchPrograms } = usePrograms({ autoFetch: false });
  const { isFeatureEnabled } = useFeatures();
  const seasonsEnabled = isFeatureEnabled("seasons");
  const { seasons } = useSeasons({ autoFetch: seasonsEnabled });
  const [searchTerm, setSearchTerm] = React.useState("");
  const [seasonFilter, setSeasonFilter] = React.useState<string>("all");
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [selectedProgram, setSelectedProgram] = React.useState<any>(null);

  const hasFetched = React.useRef(false);
  React.useEffect(() => {
    const params = {
      search: searchTerm,
      ...(seasonFilter && seasonFilter !== "all" ? { seasonId: seasonFilter } : {}),
    };
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchPrograms(params);
      return;
    }
    const timer = setTimeout(() => fetchPrograms(params), 500);
    return () => clearTimeout(timer);
  }, [searchTerm, seasonFilter, fetchPrograms]);

  const handleQuickConfigure = (program: any) => {
    setSelectedProgram(program);
    setIsConfigOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground">
            Manage your registration programs and enrollment options.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/registrations/programs/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Program
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search programs..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {seasonsEnabled && seasons.length > 0 && (
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Seasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Seasons</SelectItem>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading && programs.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="mr-2 h-6 w-6" />
          <p>{error}</p>
        </div>
      )}

      {/* Quick Configuration Sheet */}
      <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <SheetContent className="sm:max-w-2xl p-0">
          {selectedProgram ? (
            <ProgramConfiguration
              program={selectedProgram}
              onClose={() => setIsConfigOpen(false)}
              onUpdated={() => fetchPrograms()}
            />
          ) : (
            <div className="p-6">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {!isLoading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => {
            const p = program as any;
            const isRecurring =
              p.billingInterval &&
              p.billingInterval !== "ONE_TIME" &&
              p.billingInterval !== "SESSION" &&
              p.recurringPrice;
            const price = isRecurring ? p.recurringPrice : p.basePrice || p.perSessionPrice;
            const levelReqs = p.levelRequirements || [];
            const staffAssignments = p.staffAssignments || [];
            const requiredMemberships = p.requiredMemberships || [];
            const capacity = p.capacity || 0;
            const enrolled = program._count?.enrollments || 0;
            const hasCapacity = p.hasCapacityRestriction && capacity > 0;
            const spotsLeft = hasCapacity ? Math.max(0, capacity - enrolled) : null;
            const regStatus = getRegistrationStatus(p);

            const daysLabel = p.rrule ? formatRRuleDays(p.rrule) : null;

            // Age restriction label
            const hasAge = p.hasAgeRestriction && (p.minAge !== null || p.maxAge !== null);
            const ageLabel = hasAge
              ? p.minAge && p.maxAge
                ? `Ages ${p.minAge}–${p.maxAge}`
                : p.minAge
                  ? `Ages ${p.minAge}+`
                  : `Up to age ${p.maxAge}`
              : null;

            return (
              <Card key={program.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5 min-w-0">
                      <CardTitle className="leading-tight">
                        <Link
                          href={`/dashboard/registrations/programs/${program.id}`}
                          className="hover:underline"
                        >
                          {program.name}
                        </Link>
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: program.color || "#3b82f6" }}
                        />
                        {levelReqs.map((lr: any) => (
                          <Badge
                            key={lr.id}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                            style={
                              lr.level?.color
                                ? {
                                    backgroundColor: `${lr.level.color}15`,
                                    color: lr.level.color,
                                    borderColor: `${lr.level.color}40`,
                                  }
                                : undefined
                            }
                          >
                            {lr.level?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          regStatus === "open"
                            ? "text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                            : regStatus === "scheduled"
                              ? "text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
                              : "text-[10px] px-1.5 py-0 bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-700"
                        }
                      >
                        {regStatus === "open"
                          ? "Open"
                          : regStatus === "scheduled"
                            ? "Scheduled"
                            : "Closed"}
                      </Badge>
                      {program.season && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{ borderColor: program.season.color, color: program.season.color }}
                        >
                          {program.season.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  {program.description && (
                    <div
                      className="text-sm text-muted-foreground line-clamp-2 mb-3 [&>p]:m-0"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.description) }}
                    />
                  )}

                  {/* Info grid */}
                  <div className="space-y-1.5">
                    {/* Schedule type + price */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Repeat className="h-3.5 w-3.5" />
                        <span>Recurring</span>
                        {p.registrationType === "PER_INSTANCE" && (
                          <span className="text-primary">(Drop-in)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium">
                        <span>{formatPrice(price)}</span>
                        {price && isRecurring && p.billingInterval === "MONTHLY" && (
                          <span className="text-muted-foreground">/month</span>
                        )}
                        {price && isRecurring && p.billingInterval === "YEARLY" && (
                          <span className="text-muted-foreground">/year</span>
                        )}
                        {price && !isRecurring && p.pricingModel === "PER_SESSION" && (
                          <span className="text-muted-foreground">/session</span>
                        )}
                      </div>
                    </div>

                    {daysLabel && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span>{daysLabel}</span>
                      </div>
                    )}

                    {/* Location */}
                    {p.facility && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>
                          {p.facility.name}
                          {p.facility.city && `, ${p.facility.city}`}
                        </span>
                      </div>
                    )}

                    {/* Time */}
                    {p.startTime && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {p.startTime}
                          {p.duration ? ` (${p.duration} min)` : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tags row: capacity, age, membership */}
                  {(hasCapacity || ageLabel || requiredMemberships.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {hasCapacity && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-full">
                          <Users className="h-3 w-3" />
                          {spotsLeft !== null ? `${enrolled}/${capacity}` : `${capacity} cap`}
                        </div>
                      )}
                      {ageLabel && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                          <UserCheck className="h-3 w-3" />
                          {ageLabel}
                        </div>
                      )}
                      {requiredMemberships.length > 0 && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                          <Shield className="h-3 w-3" />
                          Membership Req.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Coaches */}
                  {staffAssignments.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {staffAssignments.slice(0, 3).map((sa: any) => (
                          <Avatar key={sa.id} className="h-6 w-6 border-2 border-background">
                            <AvatarImage src={sa.member?.user?.avatar || ""} />
                            <AvatarFallback className="text-[10px]">
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {staffAssignments.slice(0, 2).map((sa: any, i: number) => (
                          <span key={sa.id}>
                            {i > 0 && ", "}
                            {sa.member?.user?.name}
                            {sa.isPrimary && (
                              <Star className="h-3 w-3 inline ml-0.5 text-amber-500" />
                            )}
                          </span>
                        ))}
                        {staffAssignments.length > 2 && (
                          <span> +{staffAssignments.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t pt-3 gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/dashboard/registrations/programs/${program.id}/sessions`}>
                      <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                      Sessions
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleQuickConfigure(program)}
                    title="Configure"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
          {programs.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No programs found. Create one to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
