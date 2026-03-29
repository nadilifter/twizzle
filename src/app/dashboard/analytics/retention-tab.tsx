"use client"

import * as React from "react"
import {
  ShieldCheck,
  UserMinus,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Label,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

interface RetentionData {
  kpis: {
    retentionRate: number
    activeAthletes: number
    totalAthletes: number
    churnedThisMonth: number
    churnedLastMonth: number
    newThisMonth: number
    netGrowth: number
    avgTenureDays: number
  }
  athleteFlow: { month: string; new: number; churned: number }[]
  cohortRetention: { cohort: string; total: number; retained: number; rate: number }[]
  enrollmentHealth: { status: string; count: number }[]
  atRisk: {
    failingCharges: number
    recentCancellations: number
  }
}

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  WAITLISTED: "Waitlisted",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
}

const athleteFlowConfig = {
  new: { label: "New Athletes", color: "hsl(var(--chart-1))" },
  churned: { label: "Churned Athletes", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

const cohortConfig = {
  rate: { label: "Retention %", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig

const enrollmentHealthConfig = {
  count: { label: "Enrollments" },
  Active: { label: "Active", color: "hsl(var(--chart-1))" },
  Cancelled: { label: "Cancelled", color: "hsl(var(--chart-2))" },
  Completed: { label: "Completed", color: "hsl(var(--chart-3))" },
  Paused: { label: "Paused", color: "hsl(var(--chart-4))" },
  Waitlisted: { label: "Waitlisted", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig

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
  )
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
  )
}

function formatMonth(yyyymm: string): string {
  const [year, month] = yyyymm.split("-")
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

function formatTenure(days: number): string {
  if (days < 30) return `${days}d`
  const months = Math.round(days / 30.44)
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  return remainingMonths > 0 ? `${years}y ${remainingMonths}mo` : `${years}y`
}

export function RetentionTab() {
  const [data, setData] = React.useState<RetentionData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [flowRange, setFlowRange] = React.useState("12")

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/analytics/retention")
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Failed to load retention data")
        }
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load retention data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredFlow = React.useMemo(() => {
    if (!data) return []
    const months = Number(flowRange)
    return data.athleteFlow.slice(-months)
  }, [data, flowRange])

  const enrollmentChartData = React.useMemo(() => {
    if (!data) return []
    return data.enrollmentHealth
      .filter((e) => e.count > 0)
      .map((e) => ({
        status: ENROLLMENT_STATUS_LABELS[e.status] || e.status,
        count: e.count,
        fill: `var(--color-${ENROLLMENT_STATUS_LABELS[e.status] || e.status})`,
      }))
  }, [data])

  const totalEnrollments = React.useMemo(() => {
    if (!data) return 0
    return data.enrollmentHealth.reduce((sum, e) => sum + e.count, 0)
  }, [data])

  return (
    <>
      {error && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
      ) : data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.retentionRate}%</div>
              <p className="text-xs text-muted-foreground">
                {data.kpis.activeAthletes.toLocaleString()} of {data.kpis.totalAthletes.toLocaleString()} all-time athletes still active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn This Month</CardTitle>
              <UserMinus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.churnedThisMonth}</div>
              <p className="text-xs text-muted-foreground">
                {data.kpis.churnedLastMonth > 0 ? (
                  <span className="flex items-center gap-1">
                    {data.kpis.churnedThisMonth <= data.kpis.churnedLastMonth ? (
                      <TrendingDown className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingUp className="h-3 w-3 text-red-500" />
                    )}
                    vs {data.kpis.churnedLastMonth} last month
                  </span>
                ) : (
                  "Athletes who became inactive this month"
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Growth</CardTitle>
              {data.kpis.netGrowth >= 0 ? (
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.kpis.netGrowth > 0 ? "+" : ""}{data.kpis.netGrowth}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.kpis.newThisMonth} new &minus; {data.kpis.churnedThisMonth} churned this month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Tenure</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTenure(data.kpis.avgTenureDays)}</div>
              <p className="text-xs text-muted-foreground">Average time as active member</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Athlete Flow */}
      {loading ? (
        <ChartSkeleton />
      ) : data && (
        <Card>
          <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
            <div className="grid flex-1 gap-1 text-center sm:text-left">
              <CardTitle>Athlete Flow</CardTitle>
              <CardDescription>Monthly new athletes vs churned athletes</CardDescription>
            </div>
            <Select value={flowRange} onValueChange={setFlowRange}>
              <SelectTrigger className="w-[160px] rounded-lg sm:ml-auto" aria-label="Select time range">
                <SelectValue placeholder="Last 12 months" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="12" className="rounded-lg">Last 12 months</SelectItem>
                <SelectItem value="6" className="rounded-lg">Last 6 months</SelectItem>
                <SelectItem value="3" className="rounded-lg">Last 3 months</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            {filteredFlow.length > 0 ? (
              <ChartContainer config={athleteFlowConfig} className="aspect-auto h-[250px] w-full">
                <BarChart data={filteredFlow}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={formatMonth}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={formatMonth}
                        indicator="dot"
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="new" fill="var(--color-new)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="churned" fill="var(--color-churned)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No athlete flow data available
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Retention by Join Month */}
      {loading ? (
        <ChartSkeleton />
      ) : data && (
        <Card>
          <CardHeader>
            <CardTitle>Retention by Join Month</CardTitle>
            <CardDescription>
              Percentage of athletes from each month&apos;s intake that remain active today
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.cohortRetention.length > 0 ? (
              <ChartContainer config={cohortConfig} className="aspect-auto h-[250px] w-full">
                <BarChart data={data.cohortRetention}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="cohort"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={formatMonth}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={formatMonth}
                        formatter={(value, _name, item) => {
                          const row = item.payload
                          return `${value}% (${row.retained} of ${row.total})`
                        }}
                      />
                    }
                  />
                  <Bar dataKey="rate" fill="var(--color-rate)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No cohort data available
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom Row: Enrollment Health + At-Risk */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton className="flex flex-col" />
          <ChartSkeleton />
        </div>
      ) : data && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Enrollment Health */}
          <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
              <CardTitle>Enrollment Health</CardTitle>
              <CardDescription>Current enrollment status breakdown</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
              {enrollmentChartData.length > 0 ? (
                <ChartContainer config={enrollmentHealthConfig} className="mx-auto aspect-square max-h-[250px]">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={enrollmentChartData}
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
                            return (
                              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                                  {totalEnrollments.toLocaleString()}
                                </tspan>
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-xs">
                                  Total
                                </tspan>
                              </text>
                            )
                          }
                        }}
                      />
                    </Pie>
                    <ChartLegend content={<ChartLegendContent />} className="flex-wrap gap-2" />
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  No enrollment data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* At-Risk Indicators */}
          <Card>
            <CardHeader>
              <CardTitle>At-Risk Indicators</CardTitle>
              <CardDescription>Signals that may indicate upcoming churn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Failing Recurring Charges</p>
                  <p className="text-xs text-muted-foreground">
                    Athletes with payment failures
                  </p>
                </div>
                <div className="text-2xl font-bold">{data.atRisk.failingCharges}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
                  <UserMinus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Recent Cancellations</p>
                  <p className="text-xs text-muted-foreground">
                    Enrollments cancelled in last 30 days
                  </p>
                </div>
                <div className="text-2xl font-bold">{data.atRisk.recentCancellations}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
