"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { FlaskConical, ArrowLeft, Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Area, AreaChart } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { REPORT_BY_SLUG, COMING_SOON_BADGE_CLASS } from "../report-definitions";

interface DemoMetric {
  label: string;
  value: string;
  subtext: string;
}

interface DemoChartDef {
  type: "bar" | "area" | "skeleton";
  data: Record<string, string | number>[];
  config: ChartConfig;
  dataKey: string;
  categoryKey: string;
}

interface ReportDemo {
  metrics: DemoMetric[];
  chart: DemoChartDef;
}

const DEMO_DATA: Record<string, ReportDemo> = {
  revenue: {
    metrics: [
      { label: "Total Revenue", value: "$48,250", subtext: "Last 30 days" },
      { label: "Programs", value: "$28,500", subtext: "59% of total" },
      { label: "Memberships", value: "$12,400", subtext: "26% of total" },
      { label: "Store", value: "$7,350", subtext: "15% of total" },
    ],
    chart: {
      type: "bar",
      data: [
        { month: "Oct", revenue: 38200 },
        { month: "Nov", revenue: 41500 },
        { month: "Dec", revenue: 35800 },
        { month: "Jan", revenue: 42100 },
        { month: "Feb", revenue: 45600 },
        { month: "Mar", revenue: 48250 },
      ],
      config: { revenue: { label: "Revenue", color: "hsl(var(--chart-1))" } },
      dataKey: "revenue",
      categoryKey: "month",
    },
  },
  enrollment: {
    metrics: [
      { label: "New Enrollments", value: "127", subtext: "Last 30 days" },
      { label: "Cancellations", value: "18", subtext: "Last 30 days" },
      { label: "Net Growth", value: "+109", subtext: "14% increase" },
      { label: "Active Enrollments", value: "1,284", subtext: "Across all programs" },
    ],
    chart: {
      type: "area",
      data: [
        { month: "Oct", enrollments: 98 },
        { month: "Nov", enrollments: 112 },
        { month: "Dec", enrollments: 85 },
        { month: "Jan", enrollments: 134 },
        { month: "Feb", enrollments: 119 },
        { month: "Mar", enrollments: 127 },
      ],
      config: { enrollments: { label: "Enrollments", color: "hsl(var(--chart-2))" } },
      dataKey: "enrollments",
      categoryKey: "month",
    },
  },
  retention: {
    metrics: [
      { label: "Retention Rate", value: "87%", subtext: "Last 90 days" },
      { label: "Churn Rate", value: "4.2%", subtext: "Monthly average" },
      { label: "Avg. Member Tenure", value: "14 mo", subtext: "Active members" },
      { label: "At-Risk Members", value: "23", subtext: "No activity in 60 days" },
    ],
    chart: { type: "skeleton", data: [], config: {}, dataKey: "", categoryKey: "" },
  },
  attendance: {
    metrics: [
      { label: "Avg. Attendance", value: "78%", subtext: "Last 30 days" },
      { label: "Total Check-ins", value: "3,412", subtext: "Last 30 days" },
      { label: "No-Show Rate", value: "8.5%", subtext: "Last 30 days" },
      { label: "Peak Day", value: "Tuesday", subtext: "Highest attendance" },
    ],
    chart: { type: "skeleton", data: [], config: {}, dataKey: "", categoryKey: "" },
  },
  "program-performance": {
    metrics: [
      { label: "Top Program", value: "Tumbling", subtext: "$8,200 revenue" },
      { label: "Avg. Utilization", value: "72%", subtext: "Across all programs" },
      { label: "Full Programs", value: "4", subtext: "At capacity" },
      { label: "Underutilized", value: "3", subtext: "Below 50% capacity" },
    ],
    chart: { type: "skeleton", data: [], config: {}, dataKey: "", categoryKey: "" },
  },
  "accounts-receivable": {
    metrics: [
      { label: "Total Outstanding", value: "$14,820", subtext: "All open invoices" },
      { label: "Current (0-30)", value: "$8,450", subtext: "57% of total" },
      { label: "Overdue (31-60)", value: "$4,120", subtext: "28% of total" },
      { label: "Past Due (61-90+)", value: "$2,250", subtext: "15% of total" },
    ],
    chart: { type: "skeleton", data: [], config: {}, dataKey: "", categoryKey: "" },
  },
  "tax-collection": {
    metrics: [
      { label: "Total Collected", value: "$3,614", subtext: "Last 30 days" },
      { label: "Sales Tax", value: "$2,890", subtext: "State + local" },
      { label: "Service Tax", value: "$724", subtext: "Program fees" },
      { label: "Pending Remittance", value: "$1,205", subtext: "Due this quarter" },
    ],
    chart: { type: "skeleton", data: [], config: {}, dataKey: "", categoryKey: "" },
  },
  "membership-growth": {
    metrics: [
      { label: "Active Memberships", value: "842", subtext: "Current total" },
      { label: "New This Month", value: "38", subtext: "4.7% growth" },
      { label: "Most Popular", value: "Annual", subtext: "412 members" },
      { label: "Renewal Rate", value: "91%", subtext: "Last 90 days" },
    ],
    chart: { type: "skeleton", data: [], config: {}, dataKey: "", categoryKey: "" },
  },
};

function DemoChart({ chart }: { chart: DemoChartDef }) {
  if (chart.type === "skeleton") {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center gap-3">
        <div className="space-y-2 w-full max-w-md">
          <Skeleton className="h-[200px] w-full" />
          <div className="flex justify-between">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-12" />
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Chart visualization coming soon</p>
      </div>
    );
  }

  if (chart.type === "area") {
    return (
      <ChartContainer config={chart.config} className="h-[300px] w-full">
        <AreaChart data={chart.data}>
          <defs>
            <linearGradient id={`fill-${chart.dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${chart.dataKey})`} stopOpacity={0.8} />
              <stop offset="95%" stopColor={`var(--color-${chart.dataKey})`} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={chart.categoryKey} tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <Area
            dataKey={chart.dataKey}
            type="natural"
            fill={`url(#fill-${chart.dataKey})`}
            stroke={`var(--color-${chart.dataKey})`}
          />
        </AreaChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={chart.config} className="h-[300px] w-full">
      <BarChart data={chart.data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={chart.categoryKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey={chart.dataKey} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export default function ReportDetailPage() {
  const params = useParams<{ slug: string }>();
  const definition = REPORT_BY_SLUG[params.slug];
  const demo = DEMO_DATA[params.slug];

  if (!definition) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <DashboardPageHeader title="Report Not Found" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>The requested report does not exist.</p>
            <Button variant="ghost" className="mt-4" asChild>
              <Link href="/dashboard/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Reports
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ReportIcon = definition.icon;

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title={definition.title}
        description={definition.description}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled title="Coming soon">
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                All Reports
              </Link>
            </Button>
          </div>
        }
      />

      <Alert>
        <FlaskConical className="h-4 w-4" />
        <AlertTitle>Demo Data</AlertTitle>
        <AlertDescription>
          This report is showing placeholder data for preview purposes. Live data integration is
          coming soon.
        </AlertDescription>
      </Alert>

      {demo && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {demo.metrics.map((metric) => (
              <Card key={metric.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                  <ReportIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <p className="text-xs text-muted-foreground">{metric.subtext}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{definition.title}</CardTitle>
                <CardDescription>
                  {demo.chart.type === "skeleton"
                    ? "Detailed chart visualization will be available here"
                    : "Demo data for the last 6 months"}
                </CardDescription>
              </div>
              <Badge variant="secondary" className={COMING_SOON_BADGE_CLASS}>
                Coming Soon
              </Badge>
            </CardHeader>
            <CardContent>
              <DemoChart chart={demo.chart} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
