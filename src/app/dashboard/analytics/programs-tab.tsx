"use client"

import * as React from "react"
import {
  BookOpen,
  UserPlus,
  BarChart3,
  Clock,
  DollarSign,
} from "lucide-react"
import {
  Area,
  AreaChart,
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

interface ProgramsData {
  kpis: {
    activePrograms: number
    activeEnrollments: number
    waitlisted: number
    avgFillRate: number
  }
  enrollmentTrend: { month: string; count: number }[]
  fillRates: { name: string; enrolled: number; capacity: number; rate: number }[]
  enrollmentsByStatus: { status: string; count: number }[]
  topByRevenue: { name: string; revenue: number }[]
}

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  WAITLISTED: "Waitlisted",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
}

const trendConfig = {
  count: { label: "New Enrollments", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig

const fillRateConfig = {
  enrolled: { label: "Enrolled", color: "hsl(var(--chart-1))" },
  capacity: { label: "Capacity", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

const enrollmentStatusConfig = {
  count: { label: "Enrollments" },
  Active: { label: "Active", color: "hsl(var(--chart-1))" },
  Cancelled: { label: "Cancelled", color: "hsl(var(--chart-2))" },
  Completed: { label: "Completed", color: "hsl(var(--chart-3))" },
  Paused: { label: "Paused", color: "hsl(var(--chart-4))" },
  Waitlisted: { label: "Waitlisted", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig

const revenueConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function ProgramsTab() {
  const [data, setData] = React.useState<ProgramsData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [trendRange, setTrendRange] = React.useState("12")

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/analytics/programs")
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Failed to load programs data")
        }
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load programs data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredTrend = React.useMemo(() => {
    if (!data) return []
    const months = Number(trendRange)
    return data.enrollmentTrend.slice(-months)
  }, [data, trendRange])

  const statusChartData = React.useMemo(() => {
    if (!data) return []
    return data.enrollmentsByStatus
      .filter((row) => row.count > 0)
      .map((row) => ({
        status: ENROLLMENT_STATUS_LABELS[row.status] || row.status,
        count: row.count,
        fill: `var(--color-${ENROLLMENT_STATUS_LABELS[row.status] || row.status})`,
      }))
  }, [data])

  const totalEnrollments = React.useMemo(() => {
    if (!data) return 0
    return data.enrollmentsByStatus.reduce((sum, r) => sum + r.count, 0)
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
              <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.activePrograms}</div>
              <p className="text-xs text-muted-foreground">
                Currently running programs
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Enrollments</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.activeEnrollments.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Athletes currently enrolled
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Fill Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.avgFillRate}%</div>
              <p className="text-xs text-muted-foreground">
                Across programs with capacity
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waitlisted</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.waitlisted}</div>
              <p className="text-xs text-muted-foreground">
                Athletes waiting for a spot
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Enrollment Trend */}
      {loading ? (
        <ChartSkeleton />
      ) : data && (
        <Card>
          <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
            <div className="grid flex-1 gap-1 text-center sm:text-left">
              <CardTitle>Enrollment Trend</CardTitle>
              <CardDescription>Monthly new enrollments over time</CardDescription>
            </div>
            <Select value={trendRange} onValueChange={setTrendRange}>
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
            {filteredTrend.length > 0 ? (
              <ChartContainer config={trendConfig} className="aspect-auto h-[250px] w-full">
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
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={formatMonth}
                      />
                    }
                  />
                  <Area
                    dataKey="count"
                    type="monotone"
                    fill="url(#fillEnrollments)"
                    stroke="var(--color-count)"
                    strokeWidth={2}
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
      )}

      {/* Program Fill Rates */}
      {loading ? (
        <ChartSkeleton />
      ) : data && (
        <Card>
          <CardHeader>
            <CardTitle>Program Fill Rates</CardTitle>
            <CardDescription>Current enrollment vs capacity for top programs</CardDescription>
          </CardHeader>
          <CardContent>
            {data.fillRates.length > 0 ? (
              <ChartContainer config={fillRateConfig} className="aspect-auto h-[300px] w-full">
                <BarChart data={data.fillRates} layout="vertical">
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) => {
                          if (name === "enrolled") {
                            return `${value} (${item.payload.rate}% full)`
                          }
                          return value
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="enrolled" fill="var(--color-enrolled)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="capacity" fill="var(--color-capacity)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No programs with capacity set
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom Row: Enrollment Status + Top by Revenue */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton className="flex flex-col" />
          <ChartSkeleton />
        </div>
      ) : data && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Enrollment Status Breakdown */}
          <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
              <CardTitle>Enrollment Status</CardTitle>
              <CardDescription>All enrollments by current status</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
              {statusChartData.length > 0 ? (
                <ChartContainer config={enrollmentStatusConfig} className="mx-auto aspect-square max-h-[250px]">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
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

          {/* Top Programs by Revenue */}
          <Card>
            <CardHeader>
              <CardTitle>Top Programs by Revenue</CardTitle>
              <CardDescription>Revenue from paid invoices by program</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topByRevenue.length > 0 ? (
                <ChartContainer config={revenueConfig} className="aspect-auto h-[250px] w-full">
                  <BarChart data={data.topByRevenue} layout="vertical">
                    <CartesianGrid horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatCurrencyFull(Number(value))}
                        />
                      }
                    />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  No program revenue data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
