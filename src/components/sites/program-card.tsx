"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, Users, ShoppingCart, User, AlertCircle, Star } from "lucide-react";
import { useCart } from "@/components/sites/cart-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

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

interface ProgramCardProps {
  program: {
    id: string;
    name: string;
    description: string | null;
    level: string;
    membershipTiers?: MembershipTier[];
    staffAssignments?: StaffAssignment[];
    requiredMemberships?: RequiredMembership[];
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
  
  const [selectedTierId, setSelectedTierId] = useState<string>(
    membershipTiers.length === 1 ? membershipTiers[0].id : ""
  );

  const handleAddToCart = () => {
    if (!selectedTierId) return;

    const tier = membershipTiers.find((t) => t.id === selectedTierId);
    if (!tier) return;

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

  const lowestPrice = membershipTiers.length > 0
    ? Math.min(...membershipTiers.map(t => typeof t.price === "string" ? parseFloat(t.price) : t.price))
    : null;

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
            {program.name}
          </h3>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {program.level}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {program.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {program.description}
          </p>
        )}

        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{program.level}</span>
          </div>
          {membershipTiers.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{membershipTiers.length} option{membershipTiers.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Coaches Section */}
        {staffAssignments.length > 0 && (
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
        ) : (
            <div className="text-sm text-muted-foreground">No options available</div>
        )}

        <Button
          onClick={handleAddToCart}
          disabled={!selectedTierId}
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95"
        >
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
}
