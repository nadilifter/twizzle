"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Check, X, Clock, Loader2, CalendarIcon, Search, Users, 
  TrendingUp, TrendingDown, UserCheck, UserX, AlertCircle, Download
} from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"
import { DateRange } from "react-day-picker"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Pie, PieChart, Cell, Label as RechartsLabel } from "recharts"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { useAttendanceMetrics } from "@/hooks/use-attendance-metrics"
import type { AttendanceBreakdownItem, AttendanceGroupBy } from "@/types/attendance"

const statusColors = {
  present: "hsl(var(--chart-1))",
  absent: "hsl(var(--chart-2))",
  late: "hsl(var(--chart-3))",
  excused: "hsl(var(--chart-4))",
}

const statusChartConfig = {
  present: { label: "Present", color: "hsl(142.1 76.2% 36.3%)" },
  absent: { label: "Absent", color: "hsl(0 72.2% 50.6%)" },
  late: { label: "Late", color: "hsl(45.4 93.4% 47.5%)" },
  excused: { label: "Excused", color: "hsl(221.2 83.2% 53.3%)" },
} satisfies ChartConfig

const trendChartConfig = {
  rate: { label: "Attendance Rate", color: "hsl(var(--primary))" },
} satisfies ChartConfig

export default function AttendancePage() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })
  const [search, setSearch] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<AttendanceGroupBy>("overall")
  
  // Fetch metrics based on active tab
  const { metrics, isLoading, fetchMetrics } = useAttendanceMetrics({
    autoFetch: false,
    initialFilters: {
      groupBy: "overall",
      startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    },
  })

  // Refetch when date range or tab changes
  React.useEffect(() => {
    const newGroupBy = activeTab === "overall" ? "date" : activeTab
    fetchMetrics({
      groupBy: activeTab === "overall" ? "overall" : newGroupBy,
      startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    })
  }, [dateRange, activeTab, fetchMetrics])
  
  // Also fetch date trend data for the overview
  const { metrics: trendMetrics, fetchMetrics: fetchTrendMetrics } = useAttendanceMetrics()
  
  React.useEffect(() => {
    if (activeTab === "overall") {
      fetchTrendMetrics({
        groupBy: "date",
        startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
        endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
      })
    }
  }, [dateRange, activeTab, fetchTrendMetrics])

  // Filter breakdown items by search
  const filteredBreakdown = React.useMemo(() => {
    if (!metrics?.breakdown || !search) return metrics?.breakdown || []
    const searchLower = search.toLowerCase()
    return metrics.breakdown.filter(item => 
      item.name.toLowerCase().includes(searchLower)
    )
  }, [metrics?.breakdown, search])

  // Prepare status distribution chart data
  const statusDistributionData = React.useMemo(() => {
    if (!metrics?.summary) return []
    return [
      { status: "present", count: metrics.summary.present, fill: statusChartConfig.present.color },
      { status: "absent", count: metrics.summary.absent, fill: statusChartConfig.absent.color },
      { status: "late", count: metrics.summary.late, fill: statusChartConfig.late.color },
      { status: "excused", count: metrics.summary.excused, fill: statusChartConfig.excused.color },
    ]
  }, [metrics?.summary])

  // Prepare trend chart data
  const trendData = React.useMemo(() => {
    if (!trendMetrics?.breakdown) return []
    return trendMetrics.breakdown.map(item => ({
      date: item.date || item.name,
      rate: item.rate,
      total: item.total,
    })).slice(-14) // Last 14 days
  }, [trendMetrics?.breakdown])

  // Export to CSV
  const handleExport = () => {
    if (!filteredBreakdown.length) return
    
    const headers = ["Name", "Total", "Present", "Absent", "Late", "Excused", "Rate (%)"]
    const rows = filteredBreakdown.map(item => [
      item.name,
      item.total,
      item.present,
      item.absent,
      item.late,
      item.excused,
      item.rate,
    ])
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-${activeTab}-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Present</Badge>
      case "ABSENT":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Absent</Badge>
      case "LATE":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Late</Badge>
      case "EXCUSED":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Excused</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Attendance Analytics</h1>
          <p className="text-muted-foreground">
            Track and analyze attendance across athletes, programs, and coaches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.summary.attendanceRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Present + Late out of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Present</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics?.summary.present || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.summary.total ? Math.round((metrics.summary.present / metrics.summary.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Absent</CardTitle>
            <X className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics?.summary.absent || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.summary.total ? Math.round((metrics.summary.absent / metrics.summary.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.summary.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              In selected date range
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AttendanceGroupBy)} className="space-y-4">
        <ResponsiveTabsList value={activeTab} onValueChange={(v) => setActiveTab(v as AttendanceGroupBy)}>
          <TabsTrigger value="overall">Overview</TabsTrigger>
          <TabsTrigger value="athlete">By Athlete</TabsTrigger>
          <TabsTrigger value="program">By Program</TabsTrigger>
          <TabsTrigger value="coach">By Coach</TabsTrigger>
        </ResponsiveTabsList>

        {/* Overview Tab */}
        <TabsContent value="overall" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            {/* Trend Chart */}
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Attendance Trend</CardTitle>
                <CardDescription>
                  Daily attendance rate over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trendData.length > 0 ? (
                  <ChartContainer config={trendChartConfig} className="h-[300px] w-full">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => {
                          const date = new Date(value)
                          return format(date, "MMM d")
                        }}
                      />
                      <YAxis 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}%`}
                        domain={[0, 100]}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        formatter={(value) => [`${value}%`, "Rate"]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="rate" 
                        stroke="var(--color-rate)" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No attendance data for selected period
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
                <CardDescription>
                  Breakdown by attendance status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statusDistributionData.some(d => d.count > 0) ? (
                  <ChartContainer config={statusChartConfig} className="mx-auto aspect-square max-h-[280px]">
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie
                        data={statusDistributionData}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={60}
                        strokeWidth={5}
                      >
                        <RechartsLabel
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                                    {metrics?.summary.total || 0}
                                  </tspan>
                                  <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-sm">
                                    Total
                                  </tspan>
                                </text>
                              )
                            }
                          }}
                        />
                      </Pie>
                      <ChartLegend
                        content={<ChartLegendContent nameKey="status" />}
                        className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                      />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                    No attendance data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* By Athlete Tab */}
        <TabsContent value="athlete" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Attendance by Athlete</CardTitle>
                  <CardDescription>
                    Individual athlete attendance records and rates
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search athletes..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-[250px]"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBreakdown.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={item.avatar || undefined} alt={item.name} />
                              <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.level || "N/A"}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{item.total}</TableCell>
                        <TableCell className="text-center text-green-600">{item.present}</TableCell>
                        <TableCell className="text-center text-red-600">{item.absent}</TableCell>
                        <TableCell className="text-center text-yellow-600">{item.late}</TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              item.rate >= 90 ? "bg-green-50 text-green-700 border-green-200" :
                              item.rate >= 70 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                              "bg-red-50 text-red-700 border-red-200"
                            )}
                          >
                            {item.rate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Program Tab */}
        <TabsContent value="program" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Attendance by Program</CardTitle>
                  <CardDescription>
                    Program-level attendance metrics
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search programs..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-[250px]"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredBreakdown.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No program attendance data found
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredBreakdown.map((item) => (
                    <Card key={item.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              item.rate >= 90 ? "bg-green-50 text-green-700 border-green-200" :
                              item.rate >= 70 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                              "bg-red-50 text-red-700 border-red-200"
                            )}
                          >
                            {item.rate}%
                          </Badge>
                        </div>
                        {item.level && (
                          <CardDescription>Level: {item.level}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-2 text-center text-sm">
                          <div>
                            <div className="font-bold">{item.total}</div>
                            <div className="text-muted-foreground text-xs">Total</div>
                          </div>
                          <div>
                            <div className="font-bold text-green-600">{item.present}</div>
                            <div className="text-muted-foreground text-xs">Present</div>
                          </div>
                          <div>
                            <div className="font-bold text-red-600">{item.absent}</div>
                            <div className="text-muted-foreground text-xs">Absent</div>
                          </div>
                          <div>
                            <div className="font-bold text-yellow-600">{item.late}</div>
                            <div className="text-muted-foreground text-xs">Late</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Coach Tab */}
        <TabsContent value="coach" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Attendance by Coach</CardTitle>
                  <CardDescription>
                    Coach performance based on class attendance
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search coaches..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-[250px]"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coach</TableHead>
                    <TableHead className="text-center">Classes</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Attendance Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No coach attendance data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBreakdown.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={item.avatar || undefined} alt={item.name} />
                              <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{item.name}</div>
                              {item.email && (
                                <div className="text-xs text-muted-foreground">{item.email}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.total}</TableCell>
                        <TableCell className="text-center text-green-600">{item.present}</TableCell>
                        <TableCell className="text-center text-red-600">{item.absent}</TableCell>
                        <TableCell className="text-center text-yellow-600">{item.late}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div 
                                className={cn(
                                  "h-2 rounded-full",
                                  item.rate >= 90 ? "bg-green-500" :
                                  item.rate >= 70 ? "bg-yellow-500" :
                                  "bg-red-500"
                                )}
                                style={{ width: `${item.rate}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{item.rate}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
