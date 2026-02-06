"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, Users, ShoppingCart, User, AlertCircle, Star, Clock, MapPin, Repeat } from "lucide-react";
import { useCart } from "@/components/sites/cart-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MembershipRequirementDialog } from "@/components/sites/membership-requirement-dialog";
import { useState } from "react";
import { format } from "date-fns";

interface MembershipTier {
  id: string;
  name: string;
  price: number | string;
  interval?: string;
}

interface StaffAssignment {
  id: string;
  role: string;
  isPrimary: boolean;
  staffProfile: {
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

interface ProgramLevel {
  id: string;
  name: string;
  color: string | null;
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

interface ProgramInstance {
  id: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  status: string;
}

interface ProgramCardProps {
  program: {
    id: string;
    name: string;
    description: string | null;
    level: string;
    membershipTiers?: MembershipTier[];
    staffAssignments?: StaffAssignment[];
    requiredMemberships?: RequiredMembership[];
    // New fields
    programLevel?: ProgramLevel | null;
    showLevelOnSite?: boolean;
    showCoachOnSite?: boolean;
    bulkDiscounts?: BulkDiscount[];
    programType?: string;
    pricingModel?: string;
    basePrice?: number | string | null;
    perSessionPrice?: number | string | null;
    // Calendar scheduling fields
    recurrenceType?: "NON_RECURRING" | "RECURRING" | null;
    registrationType?: "ALL_INSTANCES" | "PER_INSTANCE" | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    startTime?: string | null;
    duration?: number | null;
    facility?: Facility | null;
    instances?: ProgramInstance[];
    _count?: {
      instances?: number;
    };
  };
  primaryColor?: string;
}

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

export function ProgramCard({ program, primaryColor }: ProgramCardProps) {
  const { addItem } = useCart();
  const membershipTiers = program.membershipTiers || [];
  const staffAssignments = program.staffAssignments || [];
  const requiredMemberships = program.requiredMemberships || [];
  const bulkDiscounts = program.bulkDiscounts || [];
  
  // Display options default to true for backwards compatibility
  const showLevel = program.showLevelOnSite !== false;
  const showCoach = program.showCoachOnSite !== false;
  
  // Get display level - prefer programLevel if available
  const displayLevel = program.programLevel?.name || program.level;
  const levelColor = program.programLevel?.color || null;
  
  const [selectedTierId, setSelectedTierId] = useState<string>(
    membershipTiers.length === 1 ? membershipTiers[0].id : ""
  );
  const [showMembershipDialog, setShowMembershipDialog] = useState(false);
  const [pendingCartAdd, setPendingCartAdd] = useState<{ tier?: MembershipTier; direct?: boolean } | null>(null);

  // Get the program's direct price (when no tiers)
  const directPrice = program.basePrice 
    ? (typeof program.basePrice === "string" ? parseFloat(program.basePrice) : program.basePrice)
    : program.perSessionPrice
    ? (typeof program.perSessionPrice === "string" ? parseFloat(program.perSessionPrice) : program.perSessionPrice)
    : null;
  
  // Determine if this program can be added (has tiers OR has direct pricing)
  const hasTiers = membershipTiers.length > 0;
  const canAddToCart = hasTiers ? !!selectedTierId : directPrice !== null;

  const handleAddToCart = () => {
    if (hasTiers) {
      // Tier-based program
      if (!selectedTierId) return;
      const tier = membershipTiers.find((t) => t.id === selectedTierId);
      if (!tier) return;

      // Check if there are required memberships
      if (requiredMemberships.length > 0) {
        setPendingCartAdd({ tier });
        setShowMembershipDialog(true);
        return;
      }

      addProgramToCart(tier);
    } else {
      // Direct pricing program (no tiers)
      if (directPrice === null) return;

      // Check if there are required memberships
      if (requiredMemberships.length > 0) {
        setPendingCartAdd({ direct: true });
        setShowMembershipDialog(true);
        return;
      }

      addProgramDirectly();
    }
  };

  const addProgramToCart = (tier: MembershipTier) => {
    addItem({
      referenceId: tier.id,
      type: "program",
      name: `${program.name} - ${tier.name}`,
      description: program.description || undefined,
      price: typeof tier.price === "string" ? parseFloat(tier.price) : tier.price,
      quantity: 1,
      details: {
        programId: program.id,
        level: program.level,
        interval: tier.interval,
        requiredMemberships: requiredMemberships.map(m => m.id),
      }
    });
  };

  const addProgramDirectly = () => {
    if (directPrice === null) return;
    addItem({
      referenceId: program.id,
      type: "program",
      name: program.name,
      description: program.description || undefined,
      price: directPrice,
      quantity: 1,
      details: {
        programId: program.id,
        level: program.level,
        pricingModel: program.pricingModel,
        requiredMemberships: requiredMemberships.map(m => m.id),
      }
    });
  };

  const handleMembershipDialogCancel = () => {
    setShowMembershipDialog(false);
    setPendingCartAdd(null);
  };

  const handleAddMembership = (membership: RequiredMembership) => {
    // Add the membership to cart
    addItem({
      referenceId: membership.id,
      type: "membership",
      name: membership.name,
      description: `${membership.group.name} Membership`,
      price: typeof membership.price === "string" ? parseFloat(membership.price) : membership.price,
      quantity: 1,
      details: {
        membershipInstanceId: membership.id,
        groupId: membership.group.id,
        groupName: membership.group.name,
        billingInterval: membership.billingInterval,
      }
    });

    // Also add the program if there was a pending add
    if (pendingCartAdd) {
      if (pendingCartAdd.tier) {
        addProgramToCart(pendingCartAdd.tier);
      } else if (pendingCartAdd.direct) {
        addProgramDirectly();
      }
    }

    setShowMembershipDialog(false);
    setPendingCartAdd(null);
  };

  // Calculate display price - prefer tiers, fallback to direct pricing
  const lowestPrice = membershipTiers.length > 0
    ? Math.min(...membershipTiers.map(t => typeof t.price === "string" ? parseFloat(t.price) : t.price))
    : directPrice;

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
            {program.name}
          </h3>
          {showLevel && displayLevel && (
            <Badge 
              variant="secondary" 
              className="shrink-0 text-xs"
              style={levelColor ? { backgroundColor: `${levelColor}20`, color: levelColor, borderColor: levelColor } : undefined}
            >
              {displayLevel}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {program.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {program.description}
          </p>
        )}

        {/* Schedule & Location Section */}
        {(program.startDate || program.startTime || program.facility || program.duration) && (
          <div className="mt-4 space-y-2">
            {/* Date/Time Row */}
            {program.startDate && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {program.recurrenceType === "RECURRING" && program.endDate ? (
                    <>
                      {format(new Date(program.startDate), "MMM d")} - {format(new Date(program.endDate), "MMM d, yyyy")}
                    </>
                  ) : (
                    format(new Date(program.startDate), "EEEE, MMM d, yyyy")
                  )}
                </span>
              </div>
            )}
            
            {/* Time & Duration Row */}
            {program.startTime && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {program.startTime}
                  {program.duration && ` (${program.duration} min)`}
                </span>
              </div>
            )}

            {/* Facility/Location Row */}
            {program.facility && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {program.facility.name}
                  {program.facility.city && `, ${program.facility.city}`}
                </span>
              </div>
            )}

            {/* Recurrence Info */}
            {program.recurrenceType === "RECURRING" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Repeat className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {program._count?.instances 
                    ? `${program._count.instances} sessions`
                    : "Recurring program"
                  }
                  {program.registrationType === "PER_INSTANCE" && (
                    <span className="ml-1 text-primary">(drop-in available)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-4">
          {showLevel && displayLevel && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{displayLevel}</span>
            </div>
          )}
          {membershipTiers.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{membershipTiers.length} option{membershipTiers.length !== 1 ? 's' : ''}</span>
            </div>
          ) : program.programType && !program.recurrenceType && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>
                {program.programType === "SUBSCRIPTION" ? "Subscription" 
                  : program.programType === "DROP_IN" ? "Drop-in" 
                  : "One-time"}
              </span>
            </div>
          )}
        </div>

        {/* Bulk Discounts Section */}
        {bulkDiscounts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {bulkDiscounts.map((discount) => {
              const value = typeof discount.discountValue === "string" 
                ? parseFloat(discount.discountValue) 
                : discount.discountValue;
              const label = discount.discountType === "PERCENTAGE" 
                ? `${value}% off` 
                : `$${value} off`;
              return (
                <Badge key={discount.id} variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                  {discount.type === "FAMILY_SIBLING" 
                    ? `${discount.minQuantity}+ kids: ${label}`
                    : `${discount.minQuantity}+ sessions: ${label}`
                  }
                </Badge>
              );
            })}
          </div>
        )}

        {/* Coaches Section */}
        {showCoach && staffAssignments.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">Coached by</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {staffAssignments.slice(0, 3).map((assignment) => (
                  <Avatar key={assignment.id} className="h-7 w-7 border-2 border-background">
                    <AvatarImage src={assignment.staffProfile.user.avatar || ""} />
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
                    {a.staffProfile.user.name}
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

        {/* Required Memberships Warning */}
        {requiredMemberships.length > 0 && (
          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-amber-800 dark:text-amber-200">Membership Required</p>
                <p className="text-amber-700 dark:text-amber-300">
                  {requiredMemberships.map(m => m.group.name).join(", ")}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t bg-muted/30 pt-4">
        {membershipTiers.length > 1 ? (
            <div className="w-full space-y-2">
                <Select value={selectedTierId} onValueChange={setSelectedTierId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                        {membershipTiers.map(tier => (
                            <SelectItem key={tier.id} value={tier.id}>
                                {tier.name} - {formatPrice(tier.price)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        ) : membershipTiers.length === 1 ? (
             <div className="flex items-center justify-between w-full">
                <span className="text-sm font-medium">{membershipTiers[0].name}</span>
                <span className="font-bold">{formatPrice(membershipTiers[0].price)}</span>
             </div>
        ) : directPrice !== null ? (
            <div className="flex items-center justify-between w-full">
                <span className="text-sm font-medium">
                  {program.pricingModel === "PER_SESSION" ? "Per Session" : "Program Fee"}
                </span>
                <span className="font-bold">{formatPrice(directPrice)}</span>
            </div>
        ) : (
            <div className="text-sm text-muted-foreground">Contact us for pricing</div>
        )}

        <Button
          onClick={handleAddToCart}
          disabled={!canAddToCart}
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95"
        >
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </Button>
      </CardFooter>
      
      {/* Membership Requirement Dialog */}
      <MembershipRequirementDialog
        open={showMembershipDialog}
        onOpenChange={setShowMembershipDialog}
        programName={program.name}
        requiredMemberships={requiredMemberships}
        onCancel={handleMembershipDialogCancel}
        onAddMembership={handleAddMembership}
      />
    </Card>
  );
}
