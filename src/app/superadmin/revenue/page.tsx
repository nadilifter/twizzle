"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs"
import { 
  TrendingUp, 
  TrendingDown, 
  Loader2, 
  DollarSign, 
  Users, 
  CreditCard,
  Building2,
  Repeat,
  PieChart as PieChartIcon
} from "lucide-react"
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis,
  Pie, 
  PieChart, 
  Cell, 
  Label,
  Area,
  AreaChart,
  Legend,
} from "recharts"
import { 
  ChartConfig, 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { toast } from "sonner"
import Link from "next/link"

interface RevenueData {
  kpis: {
    mrr: number
    arr: number
    totalTransactionFeeRevenue: number
    totalPlatformRevenue: number
    activePayingCustomers: number
    arpu: number
    revenueGrowth: number
    totalTransactionVolume: number
    transactionCount: number
  }
  revenueOverTime: Array<{
    period: string
    subscriptionRevenue: number
    transactionFeeRevenue: number
    totalRevenue: number
  }>
  revenueBySource: Array<{
    source: string
    amount: number
  }>
  planDistribution: Array<{
    planId: string
    planName: string
    count: number
    revenue: number
  }>
  revenueByOrg: Array<{
    organizationId: string
    organizationName: string
    subscriptionRevenue: number
    transactionFeeRevenue: number
    totalRevenue: number
    planName: string
    transactionCount: number
    transactionVolume: number
  }>
  summary: {
    totalOrganizations: number
    totalPlans: number
    dateRange: {
      start: string
      end: string
      granularity: string
    }
  }
}

const revenueOverTimeConfig = {
  subscriptionRevenue: {
    label: "Subscriptions",
    color: "hsl(var(--chart-1))",
  },
  transactionFeeRevenue: {
    label: "Transaction Fees",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const revenueBySourceConfig = {
  amount: { label: "Revenue" },
  Subscriptions: { label: "Subscriptions", color: "hsl(var(--chart-1))" },
  "Transaction Fees": { label: "Transaction Fees", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

const planDistributionConfig = {
  count: { label: "Organizations" },
} satisfies ChartConfig

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

type DateRange = "7d" | "30d" | "90d" | "12m" | "all"
type Granularity = "day" | "month" | "year"

export default function SuperadminRevenuePage() {
  const [data, setData] = React.useState<RevenueData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [dateRange, setDateRange] = React.useState<DateRange>("12m")
  const [granularity, setGranularity] = React.useState<Granularity>("month")

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("granularity", granularity)

      // Calculate date range
      const now = new Date()
      let startDate: Date

      switch (dateRange) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        case "12m":
          startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
          break
        case "all":
          startDate = new Date(2020, 0, 1) // Far back enough
          break
      }

      params.set("startDate", startDate.toISOString())
      params.set("endDate", now.toISOString())

      const response = await fetch(`/api/superadmin/revenue?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch revenue data")

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error("Error fetching revenue data:", error)
      toast.error("Failed to load revenue data")
    } finally {
      setLoading(false)
    }
  }, [dateRange, granularity])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatCurrencyCompact = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`
    }
    return formatCurrency(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalSourceRevenue = data?.revenueBySource.reduce((sum, item) => sum + item.amount, 0) || 0

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Revenue</h1>
          <p className="text-muted-foreground">
            Track SaaS subscription revenue and transaction fees across the platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
            <ResponsiveTabsList value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
              <TabsTrigger value="day">Daily</TabsTrigger>
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="year">Yearly</TabsTrigger>
            </ResponsiveTabsList>
          </Tabs>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyCompact(data?.kpis.totalPlatformRevenue || 0)}</div>
            <div className="flex items-center text-xs">
              {(data?.kpis.revenueGrowth || 0) >= 0 ? (
                <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3 text-red-600" />
              )}
              <span className={data?.kpis.revenueGrowth && data.kpis.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                {data?.kpis.revenueGrowth?.toFixed(1)}%
              </span>
              <span className="text-muted-foreground ml-1">vs prev period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyCompact(data?.kpis.mrr || 0)}</div>
            <p className="text-xs text-muted-foreground">Monthly recurring revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyCompact(data?.kpis.arr || 0)}</div>
            <p className="text-xs text-muted-foreground">Annual run rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transaction Fees</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyCompact(data?.kpis.totalTransactionFeeRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {data?.kpis.transactionCount.toLocaleString()} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paying Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.kpis.activePayingCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">Active subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.kpis.arpu || 0)}</div>
            <p className="text-xs text-muted-foreground">Avg revenue per user</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Revenue Over Time + Revenue By Source */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>
              Subscription revenue and transaction fees by {granularity}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueOverTimeConfig} className="min-h-[300px] w-full">
              <AreaChart data={data?.revenueOverTime || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => {
                    if (granularity === "month") {
                      const [year, month] = value.split("-")
                      const date = new Date(parseInt(year), parseInt(month) - 1)
                      return date.toLocaleDateString("en-US", { month: "short" })
                    }
                    if (granularity === "day") {
                      const date = new Date(value)
                      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                    return value
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <ChartTooltip 
                  content={
                    <ChartTooltipContent 
                      formatter={(value, name) => (
                        <span className="font-medium">{formatCurrency(Number(value))}</span>
                      )}
                    />
                  } 
                />
                <Area
                  type="monotone"
                  dataKey="subscriptionRevenue"
                  stackId="1"
                  stroke="var(--color-subscriptionRevenue)"
                  fill="var(--color-subscriptionRevenue)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="transactionFeeRevenue"
                  stackId="1"
                  stroke="var(--color-transactionFeeRevenue)"
                  fill="var(--color-transactionFeeRevenue)"
                  fillOpacity={0.6}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue by Source</CardTitle>
            <CardDescription>
              SaaS vs Transaction Fee Revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueBySourceConfig} className="mx-auto aspect-square max-h-[250px]">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex flex-col">
                          <span className="font-medium">{formatCurrency(Number(value))}</span>
                          <span className="text-xs text-muted-foreground">
                            {((Number(value) / totalSourceRevenue) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={data?.revenueBySource || []}
                  dataKey="amount"
                  nameKey="source"
                  innerRadius={50}
                  outerRadius={80}
                  strokeWidth={2}
                >
                  {(data?.revenueBySource || []).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CHART_COLORS[index % CHART_COLORS.length]} 
                    />
                  ))}
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
                              className="fill-foreground text-xl font-bold"
                            >
                              {formatCurrencyCompact(totalSourceRevenue)}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 18}
                              className="fill-muted-foreground text-xs"
                            >
                              Total
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
                <ChartLegend
                  content={<ChartLegendContent nameKey="source" />}
                  className="-translate-y-2 flex-wrap gap-2"
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Revenue By Org + Plan Distribution */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Top Organizations by Revenue</CardTitle>
            <CardDescription>
              Revenue breakdown for top 10 paying organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueOverTimeConfig} className="min-h-[300px] w-full">
              <BarChart 
                data={(data?.revenueByOrg || []).slice(0, 10)} 
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis 
                  type="number" 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <YAxis 
                  type="category" 
                  dataKey="organizationName" 
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 15)}...` : value}
                />
                <ChartTooltip 
                  content={
                    <ChartTooltipContent 
                      formatter={(value, name) => (
                        <span className="font-medium">{formatCurrency(Number(value))}</span>
                      )}
                    />
                  } 
                />
                <Bar 
                  dataKey="subscriptionRevenue" 
                  stackId="a" 
                  fill="var(--color-subscriptionRevenue)" 
                  radius={[0, 0, 0, 0]}
                />
                <Bar 
                  dataKey="transactionFeeRevenue" 
                  stackId="a" 
                  fill="var(--color-transactionFeeRevenue)" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Subscription Plan Distribution</CardTitle>
            <CardDescription>
              Organizations by subscription plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={planDistributionConfig} className="mx-auto aspect-square max-h-[280px]">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => (
                        <div className="flex flex-col">
                          <span className="font-medium">{value} organizations</span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(item.payload.revenue)}/mo MRR
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={data?.planDistribution || []}
                  dataKey="count"
                  nameKey="planName"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ planName, count }) => `${planName}: ${count}`}
                  labelLine={false}
                >
                  {(data?.planDistribution || []).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CHART_COLORS[index % CHART_COLORS.length]} 
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue By Organization Table */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Organization</CardTitle>
          <CardDescription>
            Detailed breakdown of revenue sources by organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.revenueByOrg.length ? (
            <p className="text-center text-muted-foreground py-8">
              No revenue data available for this period
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Subscription</TableHead>
                  <TableHead className="text-right">Transaction Fees</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.revenueByOrg.map((org) => (
                  <TableRow key={org.organizationId}>
                    <TableCell>
                      <Link
                        href={`/superadmin/organizations/${org.organizationId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {org.organizationName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.planName}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(org.subscriptionRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(org.transactionFeeRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(org.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {org.transactionCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(org.transactionVolume)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
