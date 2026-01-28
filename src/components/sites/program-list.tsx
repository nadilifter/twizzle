import { ProgramCard } from "./program-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchX } from "lucide-react";

interface MembershipTier {
  id: string;
  name: string;
  price: number | string;
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

interface Program {
  id: string;
  name: string;
  description: string | null;
  level: string;
  membershipTiers: MembershipTier[];
  staffAssignments?: StaffAssignment[];
  requiredMemberships?: RequiredMembership[];
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

  // Group programs by level
  const programsByLevel = programs.reduce((acc, program) => {
    if (!acc[program.level]) {
      acc[program.level] = [];
    }
    acc[program.level].push(program);
    return acc;
  }, {} as Record<string, Program[]>);

  const levels = Object.keys(programsByLevel);

  return (
    <div className="space-y-12">
      {levels.map((level) => {
        const levelPrograms = programsByLevel[level];
        
        return (
          <section key={level} className="scroll-mt-20">
            <div className="mb-6">
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                {level}
              </h3>
              <div className="mt-4 h-px bg-border" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {levelPrograms.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                />
              ))}
            </div>
          </section>
        );
      })}
      
      <div className="text-center text-sm text-muted-foreground">
        Showing {programs.length} program{programs.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
