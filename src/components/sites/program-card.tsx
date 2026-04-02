"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays,
  User,
  Star,
  Clock,
  MapPin,
  Repeat,
  Users,
  UserCheck,
  Shield,
  ClipboardList,
  CalendarClock,
} from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatRRuleDays } from "@/lib/rrule-utils";
import { getRegistrationStatus } from "@/lib/registration-utils";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ProgressiveImage } from "@/components/ui/progressive-image";

interface StaffAssignment {
  id: string;
  role: string;
  isPrimary: boolean;
  member: {
    id: string;
    title: string | null;
    user: {
      id: string;
      name: string;
      avatar: string | null;
    };
  };
}

interface RequiredMembership {
  id: string;
  name: string;
  price: number;
  billingInterval: string;
  group: {
    id: string;
    name: string;
  };
}

interface LevelRequirement {
  id: string;
  levelId: string;
  level: {
    id: string;
    name: string;
    color: string | null;
  };
}

interface BulkDiscount {
  id: string;
  type: "FAMILY_SIBLING" | "MULTI_SESSION";
  minQuantity: number;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number | string;
  description: string | null;
}

interface Facility {
  id: string;
  name: string;
  city?: string | null;
  stateProvince?: string | null;
}

interface ProgramCardProps {
  program: {
    id: string;
    name: string;
    description: string | null;
    imageUrl?: string | null;
    staffAssignments?: StaffAssignment[];
    requiredMemberships?: RequiredMembership[];
    levelRequirements?: LevelRequirement[];
    showCoachOnSite?: boolean;
    bulkDiscounts?: BulkDiscount[];
    pricingModel?: string;
    basePrice?: number | string | null;
    perSessionPrice?: number | string | null;
    billingInterval?: string;
    recurringPrice?: number | string | null;
    registrationType?: "ALL_INSTANCES" | "PER_INSTANCE" | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    startTime?: string | null;
    duration?: number | null;
    rrule?: string | null;
    facility?: Facility | null;
    capacity?: number | null;
    hasCapacityRestriction?: boolean;
    hasAgeRestriction?: boolean;
    minAge?: number | null;
    maxAge?: number | null;
    hasGenderRestriction?: boolean;
    allowedGenders?: ("MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY")[];
    hasLevelRestriction?: boolean;
    hasMembershipRestriction?: boolean;
    waitlistEnabled?: boolean;
    waitlistCapacity?: number | null;
    registrationOpen?: boolean;
    registrationStartDate?: string | Date | null;
    registrationStartTime?: string | null;
    registrationEndDate?: string | Date | null;
    registrationEndTime?: string | null;
    _count?: {
      instances?: number;
      enrollments?: number;
      waitlistedEnrollments?: number;
    };
  };
  primaryColor?: string;
}

const CARD_GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer Not to Say",
};

function formatPrice(price: number | string): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (numPrice === 0) return "FREE";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numPrice);
}

export function ProgramCard({ program }: ProgramCardProps) {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "";
  const staffAssignments = program.staffAssignments || [];
  const requiredMemberships = program.requiredMemberships || [];
  const levelRequirements = program.levelRequirements || [];
  const bulkDiscounts = program.bulkDiscounts || [];
  const showCoach = program.showCoachOnSite !== false;

  const isRecurring =
    program.billingInterval &&
    program.billingInterval !== "ONE_TIME" &&
    program.billingInterval !== "SESSION" &&
    program.recurringPrice;
  const directPrice = isRecurring
    ? typeof program.recurringPrice === "string"
      ? parseFloat(program.recurringPrice)
      : Number(program.recurringPrice)
    : program.basePrice
      ? typeof program.basePrice === "string"
        ? parseFloat(program.basePrice)
        : program.basePrice
      : program.perSessionPrice
        ? typeof program.perSessionPrice === "string"
          ? parseFloat(program.perSessionPrice)
          : program.perSessionPrice
        : 0;

  const totalCapacity = program.capacity || 0;
  const enrolled = program._count?.enrollments || 0;
  const spotsAvailable =
    program.hasCapacityRestriction && totalCapacity > 0
      ? Math.max(0, totalCapacity - enrolled)
      : null;

  const isFull = spotsAvailable === 0;
  const isDropIn = program.registrationType === "PER_INSTANCE";
  const waitlistedCount = program._count?.waitlistedEnrollments || 0;
  const waitlistHasRoom =
    program.waitlistEnabled &&
    (program.waitlistCapacity == null || waitlistedCount < program.waitlistCapacity);
  const canJoinWaitlist = isFull && waitlistHasRoom;
  const isSoldOut = isFull && !canJoinWaitlist && !isDropIn;

  const registrationStatus = getRegistrationStatus(program);

  const daysLabel = program.rrule ? formatRRuleDays(program.rrule) : null;

  const ageLabel =
    program.hasAgeRestriction && (program.minAge !== null || program.maxAge !== null)
      ? program.minAge && program.maxAge
        ? `Ages ${program.minAge}–${program.maxAge}`
        : program.minAge
          ? `Ages ${program.minAge}+`
          : `Up to age ${program.maxAge}`
      : null;

  const genderLabel =
    program.hasGenderRestriction && program.allowedGenders && program.allowedGenders.length > 0
      ? program.allowedGenders.map((g) => CARD_GENDER_LABELS[g] || g).join(", ")
      : null;

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
      {program.imageUrl && (
        <div className="relative aspect-video w-full overflow-hidden">
          <ProgressiveImage
            src={program.imageUrl}
            alt={program.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight text-foreground">{program.name}</h3>
          <div className="flex items-center gap-1">
            {spotsAvailable !== null && spotsAvailable <= 5 && spotsAvailable > 0 && (
              <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">
                {spotsAvailable} spot{spotsAvailable !== 1 ? "s" : ""} left
              </Badge>
            )}
            {isFull && canJoinWaitlist && (
              <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                Waitlist Available
              </Badge>
            )}
            {isSoldOut && (
              <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">
                Sold Out
              </Badge>
            )}
            {isFull && !canJoinWaitlist && isDropIn && (
              <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">
                Full
              </Badge>
            )}
          </div>
        </div>

        {levelRequirements.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {levelRequirements.map((lr) => (
              <Badge
                key={lr.id}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
                style={
                  lr.level.color
                    ? {
                        backgroundColor: `${lr.level.color}15`,
                        color: lr.level.color,
                        borderColor: `${lr.level.color}40`,
                      }
                    : undefined
                }
              >
                {lr.level.name}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {program.description && (
          <div
            className="text-sm text-muted-foreground line-clamp-2 [&>p]:m-0"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.description) }}
          />
        )}

        {(program.startDate || program.startTime || program.facility || program.duration) && (
          <div className="mt-3 space-y-1.5">
            {program.startDate && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {program.endDate ? (
                    <>
                      {format(new Date(program.startDate), "MMM d")} -{" "}
                      {format(new Date(program.endDate), "MMM d, yyyy")}
                    </>
                  ) : (
                    format(new Date(program.startDate), "EEEE, MMM d, yyyy")
                  )}
                </span>
              </div>
            )}

            {daysLabel && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                <span>{daysLabel}</span>
              </div>
            )}

            {program.startTime && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {program.startTime}
                  {program.duration && ` (${program.duration} min)`}
                </span>
              </div>
            )}

            {program.facility && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {program.facility.name}
                  {program.facility.city && `, ${program.facility.city}`}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Repeat className="h-3.5 w-3.5 shrink-0" />
              <span>
                {program._count?.instances
                  ? `${program._count.instances} sessions`
                  : "Recurring program"}
                {program.registrationType === "PER_INSTANCE" && (
                  <span className="ml-1 text-primary">(drop-in available)</span>
                )}
              </span>
            </div>
          </div>
        )}

        {(ageLabel ||
          genderLabel ||
          (program.hasCapacityRestriction && totalCapacity > 0) ||
          requiredMemberships.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ageLabel && (
              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full">
                <UserCheck className="h-3 w-3" />
                {ageLabel}
              </div>
            )}
            {genderLabel && (
              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded-full">
                <UserCheck className="h-3 w-3" />
                {genderLabel}
              </div>
            )}
            {program.hasCapacityRestriction && totalCapacity > 0 && (
              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-full">
                <Users className="h-3 w-3" />
                {spotsAvailable !== null
                  ? `${spotsAvailable} spot${spotsAvailable !== 1 ? "s" : ""} left`
                  : `${totalCapacity} spots`}
              </div>
            )}
            {requiredMemberships.length > 0 && (
              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                <Shield className="h-3 w-3" />
                Membership Required
              </div>
            )}
          </div>
        )}

        {bulkDiscounts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {bulkDiscounts.map((discount) => {
              const value =
                typeof discount.discountValue === "string"
                  ? parseFloat(discount.discountValue)
                  : discount.discountValue;
              const label =
                discount.discountType === "PERCENTAGE" ? `${value}% off` : `$${value} off`;
              return (
                <Badge
                  key={discount.id}
                  variant="outline"
                  className="text-xs text-green-600 border-green-200 bg-green-50"
                >
                  {discount.type === "FAMILY_SIBLING"
                    ? `${discount.minQuantity}+ kids: ${label}`
                    : `${discount.minQuantity}+ sessions: ${label}`}
                </Badge>
              );
            })}
          </div>
        )}

        {showCoach && staffAssignments.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">Coached by</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {staffAssignments.slice(0, 3).map((assignment) => (
                  <Avatar key={assignment.id} className="h-7 w-7 border-2 border-background">
                    <AvatarImage src={assignment.member.user.avatar || ""} />
                    <AvatarFallback className="text-xs">
                      <User className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                {staffAssignments.slice(0, 2).map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ", "}
                    {a.member.user.name}
                    {a.isPrimary && <Star className="h-3 w-3 inline ml-0.5 text-amber-500" />}
                  </span>
                ))}
                {staffAssignments.length > 2 && (
                  <span className="ml-1">+{staffAssignments.length - 2} more</span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t bg-muted/30 pt-4">
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-medium">
            {directPrice === 0
              ? "Free Program"
              : isRecurring && program.billingInterval === "MONTHLY"
                ? "Monthly Fee"
                : isRecurring && program.billingInterval === "YEARLY"
                  ? "Annual Fee"
                  : program.pricingModel === "PER_SESSION"
                    ? "Per Session"
                    : "Program Fee"}
          </span>
          <span className="font-bold">
            {formatPrice(directPrice)}
            {directPrice !== 0 && isRecurring && program.billingInterval === "MONTHLY" && (
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            )}
            {directPrice !== 0 && isRecurring && program.billingInterval === "YEARLY" && (
              <span className="text-sm font-normal text-muted-foreground">/yr</span>
            )}
            {directPrice !== 0 && !isRecurring && program.pricingModel === "PER_SESSION" && (
              <span className="text-sm font-normal text-muted-foreground">/session</span>
            )}
          </span>
        </div>

        <Button
          onClick={() => router.push(`/programs/${program.id}`)}
          disabled={isSoldOut || registrationStatus === "closed"}
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95"
        >
          <ClipboardList className="h-4 w-4" />
          {registrationStatus === "closed"
            ? "Registration Closed"
            : registrationStatus === "scheduled" && program.registrationStartDate
              ? `Opens ${format(new Date(program.registrationStartDate), "MMM d")}`
              : isFull && canJoinWaitlist
                ? "Join Waitlist"
                : isSoldOut
                  ? "Sold Out"
                  : "Register"}
        </Button>
      </CardFooter>
    </Card>
  );
}
