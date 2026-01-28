"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CalendarDays, CreditCard, User, ClipboardCheck, 
  ChevronRight, Clock, Check, X, AlertTriangle
} from "lucide-react";
import { format, isToday, isTomorrow, addDays, parseISO } from "date-fns";
import { api } from "@/lib/api-client";

interface Athlete {
  id: string;
  name: string;
  level: string;
  group: string;
  enrollments?: Array<{
    program: {
      id: string;
      name: string;
    };
  }>;
}

interface Invoice {
  id: string;
  reference: string;
  total: number;
  dueDate: string;
  status: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  location?: string;
  program?: {
    name: string;
  };
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
}

export default function AthleteDashboard() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<Invoice[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setIsLoading(true);
      try {
        // Fetch athletes
        const athletesResponse = await api.get<{ data: any[] }>("/api/athletes", {});
        const athleteData = athletesResponse.data.map((athlete: any) => ({
          id: athlete.id,
          name: athlete.name,
          level: athlete.level,
          group: athlete.group,
          enrollments: athlete.enrollments,
        }));
        setAthletes(athleteData);

        // Fetch upcoming events (next 7 days)
        const today = format(new Date(), "yyyy-MM-dd");
        const nextWeek = format(addDays(new Date(), 7), "yyyy-MM-dd");
        const eventsResponse = await api.get<{ data: Event[] }>("/api/events", {
          startDate: today,
          endDate: nextWeek,
          limit: 5,
        });
        setUpcomingEvents(eventsResponse.data || []);

        // Fetch outstanding invoices
        try {
          const invoicesResponse = await api.get<{ data: Invoice[] }>("/api/invoices", {
            status: "SENT",
            limit: 3,
          });
          setOutstandingInvoices(invoicesResponse.data?.filter(inv => 
            inv.status === "SENT" || inv.status === "OVERDUE"
          ) || []);
        } catch {
          // Invoices API might not be accessible to all users
          setOutstandingInvoices([]);
        }

        // Fetch attendance summary for last 30 days
        if (athleteData.length > 0) {
          try {
            const attendanceResponse = await api.get<any>("/api/attendance/metrics", {
              groupBy: "overall",
              athleteId: athleteData[0].id,
            });
            setAttendanceSummary({
              total: attendanceResponse.summary?.total || 0,
              present: attendanceResponse.summary?.present || 0,
              absent: attendanceResponse.summary?.absent || 0,
              late: attendanceResponse.summary?.late || 0,
              rate: attendanceResponse.summary?.attendanceRate || 0,
            });
          } catch {
            setAttendanceSummary(null);
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const formatEventDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  const getEventTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      CLASS: "bg-blue-100 text-blue-800",
      CAMP: "bg-green-100 text-green-800",
      COMPETITION: "bg-purple-100 text-purple-800",
      PARTY: "bg-pink-100 text-pink-800",
      MEETING: "bg-orange-100 text-orange-800",
    };
    return styles[type] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold mb-4">Welcome back!</h2>
        
        {/* Outstanding Invoice Alert */}
        {outstandingInvoices.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 p-4 rounded-lg mb-6 flex items-start gap-3">
            <CreditCard className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Invoice Due</p>
              <p className="text-sm">
                You have {outstandingInvoices.length} outstanding invoice{outstandingInvoices.length > 1 ? "s" : ""} totaling $
                {outstandingInvoices.reduce((sum, inv) => sum + Number(inv.total), 0).toFixed(2)}
              </p>
              <Button variant="link" className="p-0 h-auto text-yellow-800 dark:text-yellow-200 font-bold underline">
                View Invoices
              </Button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {/* Attendance Rate Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  <p className="text-2xl font-bold">
                    {attendanceSummary?.rate || 0}%
                  </p>
                </div>
                <div className={`p-2 rounded-full ${(attendanceSummary?.rate || 0) >= 80 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                  <ClipboardCheck className={`w-5 h-5 ${(attendanceSummary?.rate || 0) >= 80 ? 'text-green-600' : 'text-yellow-600'}`} />
                </div>
              </div>
              <Link href="/athletes/attendance">
                <Button variant="link" className="p-0 h-auto mt-2 text-sm">
                  View Attendance <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Classes This Week */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Classes This Week</p>
                  <p className="text-2xl font-bold">{upcomingEvents.filter(e => e.type === "CLASS").length}</p>
                </div>
                <div className="p-2 rounded-full bg-blue-100">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Athletes */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">My Athletes</p>
                  <p className="text-2xl font-bold">{athletes.length}</p>
                </div>
                <div className="p-2 rounded-full bg-purple-100">
                  <User className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Upcoming Classes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">No upcoming classes this week</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 3).map((event) => (
                    <div key={event.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{event.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {formatEventDate(event.date)}, {event.startTime}
                        </div>
                      </div>
                      <Badge className={getEventTypeBadge(event.type)}>
                        {event.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Attendance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" /> Attendance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceSummary ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-green-600">
                        <Check className="w-4 h-4" />
                        <span className="font-bold">{attendanceSummary.present}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Present</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-yellow-600">
                        <Clock className="w-4 h-4" />
                        <span className="font-bold">{attendanceSummary.late}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Late</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-red-600">
                        <X className="w-4 h-4" />
                        <span className="font-bold">{attendanceSummary.absent}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Absent</div>
                    </div>
                  </div>
                  <Link href="/athletes/attendance">
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      View Full History
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No attendance data available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* My Athletes Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">My Athletes</h3>
          <Link href="/athletes/attendance">
            <Button variant="ghost" size="sm">
              View Attendance <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {athletes.map((athlete) => (
            <Card key={athlete.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center space-y-2">
                <Avatar className="w-16 h-16 mx-auto">
                  <AvatarFallback className="text-xl font-bold">
                    {athlete.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="font-medium">{athlete.name}</div>
                <Badge variant="outline">{athlete.level}</Badge>
                {athlete.enrollments && athlete.enrollments.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {athlete.enrollments.length} program{athlete.enrollments.length > 1 ? "s" : ""}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {athletes.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="p-8 text-center text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No athletes found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
