"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Calendar,
  CalendarClock,
  Clock,
  MapPin,
  Repeat,
  Users,
  UserCheck,
  Shield,
  Star,
  ArrowLeft,
  ArrowRight,
  Ban,
  ListEnd,
  Hourglass,
  CircleCheck,
  User,
  Check,
  Zap,
  Tag,
  Share2,
  FileText,
  ClipboardCheck,
  Heart,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isLightColor } from "@/lib/color-utils";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatRRuleDays } from "@/lib/rrule-utils";
import { formatPrice } from "@/lib/format-utils";
import { SessionCalendar, type SessionInstance } from "@/components/sites/session-calendar";
import { LocationMap } from "@/components/location-map";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import type { RegistrationStatus } from "@/lib/registration-utils";

const ROLE_ORDER: Record<string, number> = {
  LEAD_COACH: 0,
  ASSISTANT_COACH: 1,
  SUBSTITUTE: 2,
  VOLUNTEER: 3,
};

const ROLE_LABELS: Record<string, string> = {
  LEAD_COACH: "Lead Coach",
  ASSISTANT_COACH: "Assistant Coach",
  SUBSTITUTE: "Substitute",
  VOLUNTEER: "Volunteer",
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer Not to Say",
};

interface StaffAssignment {
  id: string;
  role: string;
  isPrimary: boolean;
  member: {
    id: string;
    user: {
      id: string;
      name: string;
      avatar: string | null;
    };
  };
}

interface LevelRequirement {
  id: string;
  level: { id: string; name: string; color: string | null };
}

interface BulkDiscount {
  id: string;
  type: "FAMILY_SIBLING" | "MULTI_SESSION";
  minQuantity: number;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
}

interface RequiredMembership {
  id: string;
  name: string;
  price: number;
  billingInterval: string;
  group: { id: string; name: string };
}

export interface ProgramProfileData {
  id: string;
  name: string;
  description: string | null;
  registrationType: string;
  pricingModel: string;
  basePrice: number | null;
  perSessionPrice: number | null;
  billingInterval: string;
  recurringPrice: number | null;
  startDate: string | null;
  endDate: string | null;
  rrule: string | null;
  startTime: string | null;
  duration: number | null;
  capacity: number | null;
  hasCapacityRestriction: boolean;
  hasAgeRestriction: boolean;
  minAge: number | null;
  maxAge: number | null;
  hasGenderRestriction: boolean;
  allowedGenders: string[];
  showCoachOnSite: boolean;
  waitlistEnabled: boolean;
  waitlistCapacity: number | null;
  registrationStartDate: string | null;
  imageUrl: string | null;
  facility: {
    name: string;
    city?: string | null;
    stateProvince?: string | null;
    street?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  staffAssignments: StaffAssignment[];
  levelRequirements: LevelRequirement[];
  bulkDiscounts: BulkDiscount[];
  requiredMemberships: RequiredMembership[];
  category: { id: string; name: string } | null;
  instanceCount: number;
  enrolled: number;
  waitlistedCount: number;
  waiverNames: string[];
  hasMedicalRequirement: boolean;
  hasFileRequirement: boolean;
}

interface ProgramProfileProps {
  program: ProgramProfileData;
  instances: SessionInstance[];
  registrationStatus: RegistrationStatus;
  canRegister: boolean;
  hasValidEarlyAccess: boolean;
  earlyAccessCode: string | null;
  primaryColor: string;
}

function getBestDiscount(
  discounts: BulkDiscount[],
  type: "MULTI_SESSION" | "FAMILY_SIBLING",
  quantity: number
): BulkDiscount | null {
  return (
    discounts
      .filter((d) => d.type === type && quantity >= d.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0] ?? null
  );
}

function applyDiscount(subtotal: number, discount: BulkDiscount): number {
  if (discount.discountType === "PERCENTAGE") {
    return subtotal * (1 - discount.discountValue / 100);
  }
  return Math.max(0, subtotal - discount.discountValue);
}

export function ProgramProfile({
  program,
  instances,
  registrationStatus,
  canRegister,
  hasValidEarlyAccess,
  earlyAccessCode,
  primaryColor,
}: ProgramProfileProps) {
  const router = useRouter();
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<string>>(new Set());

  const isPerInstance = program.registrationType === "PER_INSTANCE";
  const totalCapacity = program.capacity || 0;
  const spotsAvailable =
    program.hasCapacityRestriction && totalCapacity > 0
      ? Math.max(0, totalCapacity - program.enrolled)
      : null;
  const isFull = program.hasCapacityRestriction && spotsAvailable === 0;
  const waitlistHasRoom =
    program.waitlistEnabled &&
    (program.waitlistCapacity == null || program.waitlistedCount < program.waitlistCapacity);
  const canJoinWaitlist = isFull && waitlistHasRoom;
  const isSoldOut = isFull && !canJoinWaitlist && !isPerInstance;

  const daysLabel = program.rrule ? formatRRuleDays(program.rrule) : null;

  const ageLabel = useMemo(() => {
    if (!program.hasAgeRestriction || (program.minAge === null && program.maxAge === null))
      return null;
    if (program.minAge && program.maxAge) return `Ages ${program.minAge}–${program.maxAge}`;
    if (program.minAge) return `Ages ${program.minAge}+`;
    return `Up to age ${program.maxAge}`;
  }, [program.hasAgeRestriction, program.minAge, program.maxAge]);

  const genderLabel = useMemo(() => {
    if (!program.hasGenderRestriction || program.allowedGenders.length === 0) return null;
    return program.allowedGenders.map((g) => GENDER_LABELS[g] || g).join(", ");
  }, [program.hasGenderRestriction, program.allowedGenders]);

  const isRecurring =
    program.billingInterval !== "ONE_TIME" &&
    program.billingInterval !== "SESSION" &&
    program.recurringPrice;
  const priceDisplay = isRecurring
    ? formatPrice(Number(program.recurringPrice))
    : program.basePrice || program.perSessionPrice
      ? formatPrice(Number(program.basePrice || program.perSessionPrice))
      : "Free";
  const pricePeriod = isRecurring
    ? program.billingInterval === "MONTHLY"
      ? "/mo"
      : "/yr"
    : program.pricingModel === "PER_SESSION"
      ? "/session"
      : "";
  const priceLabel = isRecurring
    ? program.billingInterval === "MONTHLY"
      ? "Monthly"
      : "Annual"
    : program.pricingModel === "PER_SESSION"
      ? "Per Session"
      : program.basePrice === null && program.perSessionPrice === null
        ? ""
        : "Program Fee";

  const locationLabel = program.facility
    ? `${program.facility.name}${program.facility.city ? `, ${program.facility.city}` : ""}`
    : null;

  const facilityAddress = program.facility
    ? [program.facility.street, program.facility.city, program.facility.stateProvince]
        .filter(Boolean)
        .join(", ")
    : null;

  const sortedStaff = useMemo(() => {
    return [...program.staffAssignments].sort((a, b) => {
      const roleDiff = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
      if (roleDiff !== 0) return roleDiff;
      return (a.member.user.name ?? "").localeCompare(b.member.user.name ?? "");
    });
  }, [program.staffAssignments]);

  const toggleInstance = useCallback((id: string) => {
    setSelectedInstanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const bulkSelectInstances = useCallback((ids: string[]) => {
    setSelectedInstanceIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: program.name, url });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  }, [program.name]);

  const handleRegister = () => {
    const params = new URLSearchParams();
    if (earlyAccessCode) params.set("code", earlyAccessCode);
    if (isPerInstance && selectedInstanceIds.size > 0) {
      params.set("instances", Array.from(selectedInstanceIds).join(","));
    }
    const qs = params.toString();
    router.push(`/programs/${program.id}/register${qs ? `?${qs}` : ""}`);
  };

  const selectedSubtotal = isPerInstance
    ? selectedInstanceIds.size * (program.perSessionPrice || 0)
    : 0;

  const activeMultiSessionDiscount = isPerInstance
    ? getBestDiscount(program.bulkDiscounts, "MULTI_SESSION", selectedInstanceIds.size)
    : null;

  const selectedTotal = activeMultiSessionDiscount
    ? applyDiscount(selectedSubtotal, activeMultiSessionDiscount)
    : selectedSubtotal;

  const savings = selectedSubtotal - selectedTotal;

  const ctaDisabled =
    !canRegister || isSoldOut || (isPerInstance && selectedInstanceIds.size === 0);

  const ctaLabel = (() => {
    if (registrationStatus === "closed") return "Registration Closed";
    if (registrationStatus === "scheduled" && !hasValidEarlyAccess) {
      return program.registrationStartDate
        ? `Opens ${format(new Date(program.registrationStartDate), "MMM d")}`
        : "Coming Soon";
    }
    if (isSoldOut) return "Sold Out";
    if (isFull && canJoinWaitlist) return "Join Waitlist";
    if (isPerInstance && selectedInstanceIds.size > 0) {
      return `Register for ${selectedInstanceIds.size} session${selectedInstanceIds.size !== 1 ? "s" : ""}`;
    }
    return "Register Now";
  })();

  const detailItems = buildDetailItems(program, daysLabel, locationLabel);

  return (
    <div className="space-y-10">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 -ml-2 hover:opacity-90"
        style={{
          backgroundColor: primaryColor,
          color: isLightColor(primaryColor) ? "#111" : "#fff",
        }}
        onClick={() => router.push("/register")}
      >
        <ArrowLeft className="h-4 w-4" />
        All Programs
      </Button>

      {/* Program image */}
      {program.imageUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl">
          <ProgressiveImage
            src={program.imageUrl}
            alt={program.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1152px"
          />
        </div>
      )}

      {/* ===== Hero section ===== */}
      <div className="space-y-6">
        {/* Name + Status */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {program.category && (
              <Badge variant="outline" className="text-xs font-medium">
                {program.category.name}
              </Badge>
            )}
            {program.levelRequirements.map((lr) => (
              <Badge
                key={lr.id}
                variant="outline"
                className="text-xs font-medium"
                style={
                  lr.level.color
                    ? {
                        backgroundColor: `${lr.level.color}12`,
                        color: lr.level.color,
                        borderColor: `${lr.level.color}30`,
                      }
                    : undefined
                }
              >
                {lr.level.name}
              </Badge>
            ))}
            {isPerInstance && (
              <Badge variant="outline" className="text-xs font-medium gap-1">
                <Zap className="h-3 w-3" />
                Drop-in
              </Badge>
            )}
          </div>

          <div className="flex items-start gap-3">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] flex-1">
              {program.name}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 mt-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleShare}
              aria-label="Share program"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>

          <StatusBadge
            registrationStatus={registrationStatus}
            hasValidEarlyAccess={hasValidEarlyAccess}
            isFull={isFull}
            canJoinWaitlist={canJoinWaitlist}
            isPerInstance={isPerInstance}
            registrationStartDate={program.registrationStartDate}
          />

          {registrationStatus === "scheduled" && !hasValidEarlyAccess && (
            <EarlyAccessPrompt programId={program.id} primaryColor={primaryColor} />
          )}
        </div>

        {/* Quick facts pills */}
        {detailItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {detailItems.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1"
                style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.value}
              </span>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* ===== Two-column layout: main + sidebar ===== */}
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-10 min-w-0">
          {/* Description */}
          {program.description && (
            <div>
              <h2 className="text-lg font-semibold mb-3">About this program</h2>
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed [&>p]:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.description) }}
              />
            </div>
          )}

          {/* Registration requirements */}
          {(program.waiverNames.length > 0 ||
            program.hasMedicalRequirement ||
            program.hasFileRequirement) && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Registration Requirements</h2>
              <div className="rounded-xl border bg-card shadow-sm divide-y">
                {program.waiverNames.map((name) => (
                  <div key={name} className="flex items-center gap-3 px-4 py-3">
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm">
                      Sign <span className="font-medium">{name}</span>
                    </span>
                  </div>
                ))}
                {program.hasMedicalRequirement && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Heart className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm">Provide medical information</span>
                  </div>
                )}
                {program.hasFileRequirement && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm">Upload required documents</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Staff section */}
          {program.showCoachOnSite && sortedStaff.length > 0 && (
            <TooltipProvider delayDuration={200}>
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  {sortedStaff.length === 1 ? "Your Coach" : "Your Coaches"}
                </h2>
                <div className="flex flex-wrap gap-4">
                  {sortedStaff.map((sa) => (
                    <Tooltip key={sa.id}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-accent/50">
                          <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
                            <AvatarImage src={sa.member.user.avatar || ""} />
                            <AvatarFallback className="text-sm bg-muted">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate flex items-center gap-1">
                              {sa.member.user.name}
                              {sa.isPrimary && (
                                <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {ROLE_LABELS[sa.role] || sa.role}
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-popover text-popover-foreground border shadow-md">
                        <span className="text-xs">
                          {sa.isPrimary ? "Primary coach" : ROLE_LABELS[sa.role] || sa.role}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </TooltipProvider>
          )}

          {/* Location map */}
          {program.facility?.latitude != null && program.facility?.longitude != null && (
            <div id="location" className="scroll-mt-24">
              <h2 className="text-lg font-semibold mb-4">Location</h2>
              <div className="relative z-0 rounded-xl border overflow-hidden shadow-sm isolate">
                <LocationMap
                  latitude={program.facility.latitude}
                  longitude={program.facility.longitude}
                  label={program.facility.name}
                  sublabel={facilityAddress || undefined}
                  className="!min-h-[16rem] !rounded-none"
                />
                <div className="px-4 py-3 flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">{program.facility.name}</p>
                    {facilityAddress && <p className="text-muted-foreground">{facilityAddress}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Session calendar for PER_INSTANCE */}
          {isPerInstance && (
            <div id="sessions" className="scroll-mt-24">
              <h2 className="text-lg font-semibold mb-4">Pick your sessions</h2>
              <SessionCalendar
                instances={instances}
                selectedIds={selectedInstanceIds}
                onToggle={toggleInstance}
                onBulkSelect={bulkSelectInstances}
                waitlistEnabled={program.waitlistEnabled}
                perSessionPrice={program.perSessionPrice}
                primaryColor={primaryColor}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {/* Price card */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div
              className="px-6 py-5"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}08, ${primaryColor}15)`,
              }}
            >
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight">{priceDisplay}</span>
                {pricePeriod && (
                  <span className="text-sm text-muted-foreground">{pricePeriod}</span>
                )}
              </div>
              {priceLabel && <span className="text-xs text-muted-foreground">{priceLabel}</span>}
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Detail items */}
              {detailItems.length > 0 && (
                <div className="space-y-3">
                  {detailItems.map((item) => {
                    const Tag = item.scrollTo ? "button" : "div";
                    return (
                      <Tag
                        key={item.label}
                        className={cn(
                          "flex items-start gap-3 text-left w-full",
                          item.scrollTo &&
                            "cursor-pointer rounded-lg -mx-1 px-1 py-1 hover:bg-accent/50 transition-colors"
                        )}
                        onClick={
                          item.scrollTo
                            ? () =>
                                document
                                  .getElementById(item.scrollTo!)
                                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
                            : undefined
                        }
                      >
                        <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{item.label}</div>
                          <div className="text-sm font-medium">{item.value}</div>
                        </div>
                      </Tag>
                    );
                  })}
                </div>
              )}

              <Separator />

              {/* Attribute pills */}
              <div className="flex flex-wrap gap-1.5">
                {ageLabel && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">
                    <UserCheck className="h-3 w-3" />
                    {ageLabel}
                  </span>
                )}
                {genderLabel && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded-full">
                    <UserCheck className="h-3 w-3" />
                    {genderLabel}
                  </span>
                )}
                {program.hasCapacityRestriction && totalCapacity > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-full">
                    <Users className="h-3 w-3" />
                    {spotsAvailable !== null
                      ? spotsAvailable > 0
                        ? `${spotsAvailable} spot${spotsAvailable !== 1 ? "s" : ""} left`
                        : canJoinWaitlist
                          ? "Waitlist available"
                          : "Full"
                      : `${totalCapacity} spots`}
                  </span>
                )}
              </div>

              {/* Required memberships */}
              {program.requiredMemberships.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Required Membership
                  </p>
                  {program.requiredMemberships.map((m) => {
                    const intervalLabel =
                      m.billingInterval === "MONTHLY"
                        ? "/mo"
                        : m.billingInterval === "YEARLY"
                          ? "/yr"
                          : m.billingInterval === "SESSION"
                            ? "/session"
                            : "";
                    return (
                      <div
                        key={m.id}
                        className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2.5"
                      >
                        <Shield className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{m.group.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{m.name}</p>
                          {m.price > 0 && (
                            <p className="text-sm font-semibold mt-1 text-amber-700 dark:text-amber-300">
                              {formatPrice(m.price)}
                              {intervalLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bulk discounts */}
              {program.bulkDiscounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Discounts
                  </p>
                  {program.bulkDiscounts
                    .slice()
                    .sort((a, b) => a.minQuantity - b.minQuantity)
                    .map((discount) => {
                      const label =
                        discount.discountType === "PERCENTAGE"
                          ? `${discount.discountValue}% off`
                          : `${formatPrice(discount.discountValue)} off`;
                      const isActive =
                        discount.type === "MULTI_SESSION" &&
                        activeMultiSessionDiscount?.id === discount.id;
                      return (
                        <div
                          key={discount.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                            isActive
                              ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30"
                              : "border-border bg-muted/30"
                          )}
                        >
                          <Tag
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive
                                ? "text-green-600 dark:text-green-400"
                                : "text-muted-foreground"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-medium leading-tight",
                                isActive ? "text-green-700 dark:text-green-300" : "text-foreground"
                              )}
                            >
                              {label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {discount.type === "FAMILY_SIBLING"
                                ? `${discount.minQuantity}+ siblings`
                                : `${discount.minQuantity}+ sessions`}
                            </p>
                          </div>
                          {isActive && (
                            <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Selected sessions summary (PER_INSTANCE) */}
              {isPerInstance && selectedInstanceIds.size > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-auto px-1.5 py-0.5 text-xs -ml-1.5"
                      onClick={() => setSelectedInstanceIds(new Set())}
                    >
                      Clear all
                    </Button>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {selectedInstanceIds.size} session
                        {selectedInstanceIds.size !== 1 ? "s" : ""}
                      </span>
                      {program.perSessionPrice != null && (
                        <div className="text-right">
                          {savings > 0 ? (
                            <>
                              <span className="text-sm text-muted-foreground line-through mr-1.5">
                                {formatPrice(selectedSubtotal)}
                              </span>
                              <span className="text-lg font-bold">
                                {formatPrice(selectedTotal)}
                              </span>
                            </>
                          ) : (
                            <span className="text-lg font-bold">{formatPrice(selectedTotal)}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {savings > 0 && (
                      <div className="text-xs font-medium text-green-600 dark:text-green-400 text-right">
                        You save {formatPrice(savings)} with multi-session discount
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* CTA */}
              <Button
                onClick={handleRegister}
                disabled={ctaDisabled}
                size="lg"
                className="w-full gap-2 text-base font-semibold shadow-md transition-all hover:shadow-lg"
                style={
                  !ctaDisabled
                    ? {
                        backgroundColor: primaryColor,
                        color: isLightColor(primaryColor) ? "#111" : "#fff",
                      }
                    : undefined
                }
              >
                {ctaLabel}
                {!ctaDisabled && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile CTA bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden border-t bg-background/95 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {isPerInstance && selectedInstanceIds.size > 0 && program.perSessionPrice != null ? (
              <div>
                <span className="text-sm font-bold">{formatPrice(selectedTotal)}</span>
                {savings > 0 && (
                  <span className="text-xs text-muted-foreground line-through ml-1.5">
                    {formatPrice(selectedSubtotal)}
                  </span>
                )}
                <p className="text-xs text-muted-foreground">
                  {selectedInstanceIds.size} session{selectedInstanceIds.size !== 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <div>
                <span className="text-sm font-bold">{priceDisplay}</span>
                {pricePeriod && (
                  <span className="text-xs text-muted-foreground ml-0.5">{pricePeriod}</span>
                )}
              </div>
            )}
          </div>
          <Button
            onClick={handleRegister}
            disabled={ctaDisabled}
            size="sm"
            className="gap-1.5 font-semibold shrink-0 shadow-md"
            style={
              !ctaDisabled
                ? {
                    backgroundColor: primaryColor,
                    color: isLightColor(primaryColor) ? "#111" : "#fff",
                  }
                : undefined
            }
          >
            {ctaLabel}
            {!ctaDisabled && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Spacer for sticky mobile bar */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}

interface DetailItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  scrollTo?: string;
}

function buildDetailItems(
  program: ProgramProfileData,
  daysLabel: string | null,
  locationLabel: string | null
): DetailItem[] {
  const items: DetailItem[] = [];

  if (program.startDate) {
    items.push({
      icon: Calendar,
      label: "Dates",
      value: program.endDate
        ? `${format(new Date(program.startDate), "MMM d")} – ${format(new Date(program.endDate), "MMM d, yyyy")}`
        : format(new Date(program.startDate), "EEEE, MMM d, yyyy"),
    });
  }
  if (daysLabel) {
    items.push({ icon: CalendarClock, label: "Schedule", value: daysLabel });
  }
  if (program.startTime) {
    items.push({
      icon: Clock,
      label: "Time",
      value: `${program.startTime}${program.duration ? ` (${program.duration} min)` : ""}`,
    });
  }
  if (program.instanceCount > 0) {
    items.push({
      icon: Repeat,
      label: "Sessions",
      value: `${program.instanceCount} session${program.instanceCount !== 1 ? "s" : ""}`,
      scrollTo: "sessions",
    });
  }
  if (locationLabel) {
    items.push({ icon: MapPin, label: "Location", value: locationLabel, scrollTo: "location" });
  }

  return items;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function StatusBadge({
  registrationStatus,
  hasValidEarlyAccess,
  isFull,
  canJoinWaitlist,
  isPerInstance,
  registrationStartDate,
}: {
  registrationStatus: RegistrationStatus;
  hasValidEarlyAccess: boolean;
  isFull: boolean;
  canJoinWaitlist: boolean;
  isPerInstance: boolean;
  registrationStartDate: string | null;
}) {
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (registrationStatus !== "scheduled" || hasValidEarlyAccess || !registrationStartDate) return;

    const target = new Date(registrationStartDate).getTime();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    function tick() {
      const remaining = target - Date.now();
      if (remaining <= 0) {
        setCountdown(null);
        return;
      }
      if (remaining <= SEVEN_DAYS) {
        setCountdown(formatCountdown(remaining));
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [registrationStatus, hasValidEarlyAccess, registrationStartDate]);

  if (registrationStatus === "closed") {
    return (
      <div className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500">
        <Ban className="h-4 w-4" />
        Registration Closed
      </div>
    );
  }

  if (registrationStatus === "scheduled" && !hasValidEarlyAccess) {
    return (
      <div className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
        <Hourglass className="h-4 w-4" />
        {countdown
          ? `Opens in ${countdown}`
          : registrationStartDate
            ? `Opens ${format(new Date(registrationStartDate), "MMMM d, yyyy")}`
            : "Coming Soon"}
      </div>
    );
  }

  if (isFull) {
    if (canJoinWaitlist) {
      return (
        <div className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
          <ListEnd className="h-4 w-4" />
          Waitlist Only
        </div>
      );
    }
    if (isPerInstance) {
      return (
        <div className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
          <Zap className="h-4 w-4" />
          Drop-in Sessions Available
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500">
        <Ban className="h-4 w-4" />
        Sold Out
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
      <CircleCheck className="h-4 w-4" />
      Registration Open
    </div>
  );
}

function EarlyAccessPrompt({
  programId,
  primaryColor,
}: {
  programId: string;
  primaryColor: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/programs/${programId}?code=${encodeURIComponent(trimmed)}`);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Have an access code?
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-sm">
      <Input
        autoFocus
        placeholder="Enter access code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="h-9 text-sm"
      />
      <Button
        type="submit"
        size="sm"
        disabled={!code.trim()}
        style={{
          backgroundColor: primaryColor,
          color: isLightColor(primaryColor) ? "#111" : "#fff",
        }}
      >
        Apply
      </Button>
    </form>
  );
}
