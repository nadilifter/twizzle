import { ProgramCard } from "./program-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchX } from "lucide-react";

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

interface Program {
  id: string;
  name: string;
  description: string | null;
  staffAssignments?: StaffAssignment[];
  requiredMemberships?: RequiredMembership[];
  levelRequirements?: LevelRequirement[];
  showCoachOnSite?: boolean;
  bulkDiscounts?: BulkDiscount[];
  pricingModel?: string;
  basePrice?: number | string | null;
  perSessionPrice?: number | string | null;
  registrationType?: "ALL_INSTANCES" | "PER_INSTANCE" | null;
  capacity?: number | null;
  hasCapacityRestriction?: boolean;
  hasAgeRestriction?: boolean;
  minAge?: number | null;
  maxAge?: number | null;
  hasLevelRestriction?: boolean;
  hasMembershipRestriction?: boolean;
  waitlistEnabled?: boolean;
  waitlistCapacity?: number | null;
  _count?: {
    instances?: number;
    enrollments?: number;
    waitlistedEnrollments?: number;
  };
}

interface ProgramListProps {
  programs: Program[];
  slug: string;
}

export function ProgramList({ programs, slug }: ProgramListProps) {
  if (programs.length === 0) {
    return (
      <Alert className="border-muted">
        <SearchX className="h-4 w-4" />
        <AlertDescription>
          No programs are currently available for registration. Check back soon for new offerings.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map((program) => (
          <ProgramCard key={program.id} program={program} />
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Showing {programs.length} program{programs.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
