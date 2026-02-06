"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  GraduationCap, 
  Users, 
  CalendarDays, 
  Star,
  User,
} from "lucide-react";
import { api } from "@/lib/api-client";

interface ProgramStaff {
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

interface Program {
  id: string;
  name: string;
  description: string | null;
  status: string;
  assignmentSource: "staff" | "event";
  myRole: string | null;
  isPrimaryCoach: boolean;
  staffAssignments: ProgramStaff[];
  _count: {
    enrollments: number;
    events: number;
  };
}

const ROLE_LABELS: Record<string, string> = {
  LEAD_COACH: "Lead Coach",
  ASSISTANT_COACH: "Assistant Coach",
  SUBSTITUTE: "Substitute",
  VOLUNTEER: "Volunteer",
};

export default function CoachProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPrograms() {
      try {
        setIsLoading(true);
        const response = await api.get<{ data: Program[] }>("/api/coach/programs");
        setPrograms(response.data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch programs:", err);
        setError("Failed to load programs");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPrograms();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">My Programs</h2>
          <p className="text-sm text-muted-foreground mb-4">Programs you are assigned to as a coach</p>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">My Programs</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">My Programs</h2>
        <p className="text-sm text-muted-foreground">
          Programs you are assigned to as a coach ({programs.length} total)
        </p>
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Programs Assigned</h3>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t been assigned to any programs yet. Contact your administrator to get assigned to programs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {programs.map((program) => (
            <Card key={program.id} className="hover:bg-accent/5 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                      {program.isPrimaryCoach && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    {program.description && (
                      <CardDescription>{program.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{program._count.enrollments} enrolled</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>{program._count.events} events</span>
                  </div>
                  {program.myRole && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Badge variant="outline" className="font-normal">
                        {ROLE_LABELS[program.myRole] || program.myRole}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Other coaches */}
                {program.staffAssignments.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      Coaching Staff
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {program.staffAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-2 bg-muted/50 rounded-full pl-1 pr-3 py-1"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={assignment.staffProfile.user.avatar || ""} />
                            <AvatarFallback className="text-xs">
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {assignment.staffProfile.user.name}
                            {assignment.isPrimary && (
                              <Star className="h-3 w-3 inline ml-1 text-amber-500" />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
