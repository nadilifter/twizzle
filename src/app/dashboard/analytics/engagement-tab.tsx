"use client"

import * as React from "react"
import {
  CheckCircle2,
  CalendarCheck,
  Users,
  ClipboardCheck,
  UserX,
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

interface EngagementData {
  kpis: {
    attendanceRate: number
    classesThisMonth: number
    avgClassSize: number
    evaluationsCompleted: number
  }
  attendanceTrend: { month: string; rate: number }[]
  attendanceBreakdown: { status: string; count: number }[]
  classUtilization: { name: string; avgAttendance: number; capacity: number }[]
  inactiveAthletes: number
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
}

const trendConfig = {
  rate: { label: "Attendance Rate", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig

const breakdownConfig = {
  count: { label: "Records" },
  Present: { label: "Present", color: "hsl(var(--chart-1))" },
  Absent: { label: "Absent", color: "hsl(var(--chart-2))" },
  Late: { label: "Late", color: "hsl(var(--chart-3))" },
  Excused: { label: "Excused", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig

const utilizationConfig = {
  avgAttendance: { label: "Avg Attendance", color: "hsl(var(--chart-1))" },
  capacity: { label: "Capacity", color: "hsl(var(--chart-2))" },
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

export function EngagementTab() {
  const [data, setData] = React.useState<EngagementData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [trendRange, setTrendRange] = React.useState("12")

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/analytics/engagement")
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Failed to load engagement data")
        }
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load engagement data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredTrend = React.useMemo(() => {
    if (!data) return []
    const months = Number(trendRange)
    return data.attendanceTrend.slice(-months)
  }, [data, trendRange])

  const breakdownChartData = React.useMemo(() => {
    if (!data) return []
    return data.attendanceBreakdown
      .filter((row) => row.count > 0)
      .map((row) => ({
        status: ATTENDANCE_STATUS_LABELS[row.status] || row.status,
        count: row.count,
        fill: `var(--color-${ATTENDANCE_STATUS_LABELS[row.status] || row.status})`,
      }))
  }, [data])

  const totalAttendanceRecords = React.useMemo(() => {
    if (!data) return 0
    return data.attendanceBreakdown.reduce((sum, r) => sum + r.count, 0)
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
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.attendanceRate}%</div>
              <p className="text-xs text-muted-foreground">
                Present or on-time this month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Classes This Month</CardTitle>
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.classesThisMonth}</div>
              <p className="text-xs text-muted-foreground">
                Completed class sessions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Class Size</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.avgClassSize}</div>
              <p className="text-xs text-muted-foreground">
                Athletes per completed class
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Evaluations</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.kpis.evaluationsCompleted}</div>
              <p className="text-xs text-muted-foreground">
                Completed this month
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Trend */}
      {loading ? (
        <ChartSkeleton />
      ) : data && (
        <Card>
          <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
            <div className="grid flex-1 gap-1 text-center sm:text-left">
              <CardTitle>Attendance Trend</CardTitle>
              <CardDescription>Monthly attendance rate over time</CardDescription>
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
                    <linearGradient id="fillAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-rate)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-rate)" stopOpacity={0.1} />
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
                        formatter={(value) => `${value}%`}
                      />
                    }
                  />
                  <Area
                    dataKey="rate"
                    type="monotone"
                    fill="url(#fillAttendance)"
                    stroke="var(--color-rate)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No attendance data available
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom Row: Attendance Breakdown + Inactive Athletes */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton className="flex flex-col" />
          <ChartSkeleton />
        </div>
      ) : data && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Attendance Breakdown */}
          <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
              <CardTitle>Attendance Breakdown</CardTitle>
              <CardDescription>All-time attendance records by status</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
              {breakdownChartData.length > 0 ? (
                <ChartContainer config={breakdownConfig} className="mx-auto aspect-square max-h-[250px]">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={breakdownChartData}
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
                                  {totalAttendanceRecords.toLocaleString()}
                                </tspan>
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-xs">
                                  Records
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
                  No attendance data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inactive Athletes */}
          <Card>
            <CardHeader>
              <CardTitle>Disengagement Warning</CardTitle>
              <CardDescription>Athletes who may need attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
                  <UserX className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Inactive Athletes</p>
                  <p className="text-xs text-muted-foreground">
                    Active athletes with no class attendance in the last 30 days
                  </p>
                </div>
                <div className="text-2xl font-bold">{data.inactiveAthletes}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Class Utilization */}
      {loading ? (
        <ChartSkeleton />
      ) : data && (
        <Card>
          <CardHeader>
            <CardTitle>Class Utilization</CardTitle>
            <CardDescription>Average attendance vs capacity for top programs</CardDescription>
          </CardHeader>
          <CardContent>
            {data.classUtilization.length > 0 ? (
              <ChartContainer config={utilizationConfig} className="aspect-auto h-[300px] w-full">
                <BarChart data={data.classUtilization} layout="vertical">
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
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="avgAttendance" fill="var(--color-avgAttendance)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="capacity" fill="var(--color-capacity)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No utilization data available (programs need capacity set)
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
