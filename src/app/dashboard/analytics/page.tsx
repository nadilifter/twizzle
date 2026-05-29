"use client";

import * as React from "react";
import { Users, BookOpen, UserPlus, UsersRound, TrendingUp, TrendingDown } from "lucide-react";
import {
  Pie,
  PieChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  Label,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { FeatureGate } from "@/components/feature-gate";
import { toast } from "sonner";
import { RetentionTab } from "./retention-tab";
import { RevenueTab } from "./revenue-tab";
import { EngagementTab } from "./engagement-tab";
import { ProgramsTab } from "./programs-tab";
import { WebsiteTab } from "./website-tab";

interface AnalyticsData {
  kpis: {
    totalAthletes: number;
    newAthletes: number;
    activePrograms: number;
    totalEnrollments: number;
    teamMembers: number;
  };
  demographics: {
    age: { bucket: string; count: number }[];
    gender: { gender: string; count: number }[];
  };
  distribution: {
    byLevel: { level: string; count: number }[];
    byStatus: { status: string; count: number }[];
  };
  enrollmentTrend: { month: string; count: number }[];
}

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer Not to Say",
  UNKNOWN: "Unknown",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  TRIAL: "Trial",
  GRADUATED: "Graduated",
};

const ageConfig = {
  count: { label: "Athletes" },
  "Under 6": { label: "Under 6", color: "hsl(var(--chart-1))" },
  "6-12": { label: "6-12", color: "hsl(var(--chart-2))" },
  "13-17": { label: "13-17", color: "hsl(var(--chart-3))" },
  "18+": { label: "18+", color: "hsl(var(--chart-4))" },
  Unknown: { label: "Unknown", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const genderConfig = {
  count: { label: "Athletes" },
  Male: { label: "Male", color: "hsl(var(--chart-1))" },
  Female: { label: "Female", color: "hsl(var(--chart-2))" },
  Other: { label: "Other", color: "hsl(var(--chart-3))" },
  "Prefer Not to Say": { label: "Prefer Not to Say", color: "hsl(var(--chart-4))" },
  Unknown: { label: "Unknown", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const enrollmentConfig = {
  count: { label: "New Enrollments", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const statusConfig = {
  count: { label: "Athletes" },
  Active: { label: "Active", color: "hsl(var(--chart-1))" },
  Inactive: { label: "Inactive", color: "hsl(var(--chart-2))" },
  Trial: { label: "Trial", color: "hsl(var(--chart-3))" },
  Graduated: { label: "Graduated", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px] w-full" />
      </CardContent>
    </Card>
  );
}

function formatMonth(yyyymm: string): string {
  const [year, month] = yyyymm.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function AnalyticsPage() {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [trendRange, setTrendRange] = React.useState("12");
  const [activeTab, setActiveTab] = React.useState("overview");

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/analytics/overview");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load analytics");
        }
        setData(await res.json());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredTrend = React.useMemo(() => {
    if (!data) return [];
    const months = Number(trendRange);
    return data.enrollmentTrend.slice(-months);
  }, [data, trendRange]);

  const totalAthletesForCharts = React.useMemo(() => {
    if (!data) return 0;
    return data.demographics.age.reduce((sum, a) => sum + a.count, 0);
  }, [data]);

  const ageChartData = React.useMemo(() => {
    if (!data) return [];
    return data.demographics.age
      .filter((a) => a.count > 0)
      .map((a) => ({
        bucket: a.bucket,
        count: a.count,
        fill: `var(--color-${a.bucket})`,
      }));
  }, [data]);

  const genderChartData = React.useMemo(() => {
    if (!data) return [];
    return data.demographics.gender
      .filter((g) => g.count > 0)
      .map((g) => ({
        gender: GENDER_LABELS[g.gender] || g.gender,
        count: g.count,
        fill: `var(--color-${GENDER_LABELS[g.gender] || g.gender})`,
      }));
  }, [data]);

  const statusChartData = React.useMemo(() => {
    if (!data) return [];
    return data.distribution.byStatus
      .filter((s) => s.count > 0)
      .map((s) => ({
        status: STATUS_LABELS[s.status] || s.status,
        count: s.count,
        fill: `var(--color-${STATUS_LABELS[s.status] || s.status})`,
      }));
  }, [data]);

  const levelChartData = React.useMemo(() => {
    if (!data) return [];
    return data.distribution.byLevel.map((l) => ({
      level: l.level,
      count: l.count,
      fill: "hsl(var(--chart-1))",
    }));
  }, [data]);

  return (
    <FeatureGate feature="analytics">
      <div className="flex flex-col gap-6 p-6">
        <DashboardPageHeader
          title="Analytics"
          description="Organization-wide insights into athlete demographics, enrollment trends, and program distribution."
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ResponsiveTabsList value={activeTab} onValueChange={setActiveTab}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="programs">Programs</TabsTrigger>
            <TabsTrigger value="website">Website</TabsTrigger>
          </ResponsiveTabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* KPI Cards */}
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiSkeleton />
                <KpiSkeleton />
                <KpiSkeleton />
                <KpiSkeleton />
              </div>
            ) : (
              data && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Athletes</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {data.kpis.totalAthletes.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {data.kpis.newAthletes > 0 ? (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            {data.kpis.newAthletes} new this month
                          </span>
                        ) : (
                          "Active athletes in your organization"
                        )}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {data.kpis.activePrograms.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">Currently active programs</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {data.kpis.totalEnrollments.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">Across all programs</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                      <UsersRound className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {data.kpis.teamMembers.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">Active staff members</p>
                    </CardContent>
                  </Card>
                </div>
              )
            )}

            {/* Demographics Row */}
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <ChartSkeleton className="flex flex-col" />
                <ChartSkeleton className="flex flex-col" />
              </div>
            ) : (
              data && (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Age Distribution */}
                  <Card className="flex flex-col">
                    <CardHeader className="items-center pb-0">
                      <CardTitle>Athletes by Age Group</CardTitle>
                      <CardDescription>Active athlete age distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                      {ageChartData.length > 0 ? (
                        <ChartContainer
                          config={ageConfig}
                          className="mx-auto aspect-square max-h-[250px]"
                        >
                          <PieChart>
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent hideLabel />}
                            />
                            <Pie
                              data={ageChartData}
                              dataKey="count"
                              nameKey="bucket"
                              innerRadius={60}
                              strokeWidth={5}
                              startAngle={90}
                              endAngle={-270}
                            >
                              <Label
                                content={({ viewBox }) => {
                                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                    return (
                                      <text
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                      >
                                        <tspan
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                          className="fill-foreground text-3xl font-bold"
                                        >
                                          {totalAthletesForCharts.toLocaleString()}
                                        </tspan>
                                        <tspan
                                          x={viewBox.cx}
                                          y={(viewBox.cy || 0) + 24}
                                          className="fill-muted-foreground text-xs"
                                        >
                                          Athletes
                                        </tspan>
                                      </text>
                                    );
                                  }
                                }}
                              />
                            </Pie>
                            <ChartLegend
                              content={<ChartLegendContent />}
                              className="flex-wrap gap-2"
                            />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                          No athlete data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gender Distribution */}
                  <Card className="flex flex-col">
                    <CardHeader className="items-center pb-0">
                      <CardTitle>Athletes by Gender</CardTitle>
                      <CardDescription>Gender distribution of active athletes</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                      {genderChartData.length > 0 ? (
                        <ChartContainer
                          config={genderConfig}
                          className="mx-auto aspect-square max-h-[250px]"
                        >
                          <PieChart>
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent hideLabel />}
                            />
                            <Pie
                              data={genderChartData}
                              dataKey="count"
                              nameKey="gender"
                              innerRadius={60}
                              strokeWidth={5}
                              startAngle={90}
                              endAngle={-270}
                            >
                              <Label
                                content={({ viewBox }) => {
                                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                    return (
                                      <text
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                      >
                                        <tspan
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                          className="fill-foreground text-3xl font-bold"
                                        >
                                          {totalAthletesForCharts.toLocaleString()}
                                        </tspan>
                                        <tspan
                                          x={viewBox.cx}
                                          y={(viewBox.cy || 0) + 24}
                                          className="fill-muted-foreground text-xs"
                                        >
                                          Total
                                        </tspan>
                                      </text>
                                    );
                                  }
                                }}
                              />
                            </Pie>
                            <ChartLegend
                              content={<ChartLegendContent />}
                              className="flex-wrap gap-2"
                            />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                          No athlete data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            )}

            {/* Enrollment Trend */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              data && (
                <Card>
                  <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
                    <div className="grid flex-1 gap-1 text-center sm:text-left">
                      <CardTitle>Enrollment Trend</CardTitle>
                      <CardDescription>New enrollments per month</CardDescription>
                    </div>
                    <Select value={trendRange} onValueChange={setTrendRange}>
                      <SelectTrigger
                        className="w-[160px] rounded-lg sm:ml-auto"
                        aria-label="Select time range"
                      >
                        <SelectValue placeholder="Last 12 months" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="12" className="rounded-lg">
                          Last 12 months
                        </SelectItem>
                        <SelectItem value="6" className="rounded-lg">
                          Last 6 months
                        </SelectItem>
                        <SelectItem value="3" className="rounded-lg">
                          Last 3 months
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                    {filteredTrend.length > 0 ? (
                      <ChartContainer
                        config={enrollmentConfig}
                        className="aspect-auto h-[250px] w-full"
                      >
                        <AreaChart data={filteredTrend}>
                          <defs>
                            <linearGradient id="fillEnrollments" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={formatMonth}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent labelFormatter={formatMonth} indicator="dot" />
                            }
                          />
                          <Area
                            dataKey="count"
                            type="natural"
                            fill="url(#fillEnrollments)"
                            stroke="var(--color-count)"
                          />
                        </AreaChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                        No enrollment data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            )}

            {/* Distribution Row */}
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <ChartSkeleton />
                <ChartSkeleton className="flex flex-col" />
              </div>
            ) : (
              data && (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Level Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Athletes by Level</CardTitle>
                      <CardDescription>
                        Distribution of active athletes across levels
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {levelChartData.length > 0 ? (
                        <ChartContainer
                          config={{ count: { label: "Athletes", color: "hsl(var(--chart-1))" } }}
                          className="max-h-[250px] w-full"
                        >
                          <BarChart
                            accessibilityLayer
                            data={levelChartData}
                            layout="vertical"
                            margin={{ left: 0 }}
                          >
                            <YAxis
                              dataKey="level"
                              type="category"
                              tickLine={false}
                              tickMargin={10}
                              axisLine={false}
                              width={100}
                            />
                            <XAxis type="number" dataKey="count" hide />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent hideLabel />}
                            />
                            <Bar
                              dataKey="count"
                              layout="vertical"
                              radius={5}
                              fill="hsl(var(--chart-1))"
                            />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                          No level data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Status Distribution */}
                  <Card className="flex flex-col">
                    <CardHeader className="items-center pb-0">
                      <CardTitle>Athletes by Status</CardTitle>
                      <CardDescription>Current status breakdown</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                      {statusChartData.length > 0 ? (
                        <ChartContainer
                          config={statusConfig}
                          className="mx-auto aspect-square max-h-[250px]"
                        >
                          <PieChart>
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent hideLabel />}
                            />
                            <Pie
                              data={statusChartData}
                              dataKey="count"
                              nameKey="status"
                              innerRadius={60}
                              strokeWidth={5}
                              startAngle={90}
                              endAngle={-270}
                            >
                              <Label
                                content={({ viewBox }) => {
                                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                    const total = statusChartData.reduce(
                                      (sum, s) => sum + s.count,
                                      0
                                    );
                                    return (
                                      <text
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                      >
                                        <tspan
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                          className="fill-foreground text-3xl font-bold"
                                        >
                                          {total.toLocaleString()}
                                        </tspan>
                                        <tspan
                                          x={viewBox.cx}
                                          y={(viewBox.cy || 0) + 24}
                                          className="fill-muted-foreground text-xs"
                                        >
                                          Total
                                        </tspan>
                                      </text>
                                    );
                                  }
                                }}
                              />
                            </Pie>
                            <ChartLegend
                              content={<ChartLegendContent />}
                              className="flex-wrap gap-2"
                            />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                          No status data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            )}
          </TabsContent>

          <TabsContent value="retention" className="space-y-6 mt-6">
            <RetentionTab />
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6 mt-6">
            <RevenueTab />
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6 mt-6">
            <EngagementTab />
          </TabsContent>

          <TabsContent value="programs" className="space-y-6 mt-6">
            <ProgramsTab />
          </TabsContent>

          <TabsContent value="website" className="space-y-6 mt-6">
            <WebsiteTab />
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGate>
  );
}
