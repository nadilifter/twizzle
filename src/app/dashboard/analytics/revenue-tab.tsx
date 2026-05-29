"use client";

import * as React from "react";
import {
  DollarSign,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ReceiptText,
  Repeat,
} from "lucide-react";
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
import { toast } from "sonner";

interface RevenueData {
  kpis: {
    revenueThisMonth: number;
    revenueLastMonth: number;
    outstanding: number;
    recurringRevenue: number;
    collectionRate: number;
    totalInvoices: number;
    paidInvoices: number;
  };
  revenueTrend: { month: string; total: number }[];
  revenueByCategory: { category: string; total: number }[];
  paymentMethods: { method: string; count: number }[];
  invoicesByStatus: { status: string; count: number }[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: "Card",
  BANK: "Bank",
  CASH: "Cash",
  CHECK: "Check",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  PARTIAL: "Partial",
};

const trendConfig = {
  total: { label: "Revenue", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const categoryConfig = {
  total: { label: "Revenue" },
  Programs: { label: "Programs", color: "hsl(var(--chart-1))" },
  Events: { label: "Events", color: "hsl(var(--chart-2))" },
  Memberships: { label: "Memberships", color: "hsl(var(--chart-3))" },
  Passes: { label: "Passes", color: "hsl(var(--chart-4))" },
  Merchandise: { label: "Merchandise", color: "hsl(var(--chart-5))" },
  Competitions: { label: "Competitions", color: "hsl(var(--chart-1))" },
  Other: { label: "Other", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const paymentMethodConfig = {
  count: { label: "Payments" },
  Card: { label: "Card", color: "hsl(var(--chart-1))" },
  Bank: { label: "Bank", color: "hsl(var(--chart-2))" },
  Cash: { label: "Cash", color: "hsl(var(--chart-3))" },
  Check: { label: "Check", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

const invoiceStatusConfig = {
  count: { label: "Invoices" },
  Paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  Sent: { label: "Sent", color: "hsl(var(--chart-2))" },
  Overdue: { label: "Overdue", color: "hsl(var(--chart-3))" },
  Partial: { label: "Partial", color: "hsl(var(--chart-4))" },
  Draft: { label: "Draft", color: "hsl(var(--chart-5))" },
  Cancelled: { label: "Cancelled", color: "hsl(var(--chart-1))" },
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function RevenueTab() {
  const [data, setData] = React.useState<RevenueData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [trendRange, setTrendRange] = React.useState("12");

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/analytics/revenue");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load revenue data");
        }
        setData(await res.json());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load revenue data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredTrend = React.useMemo(() => {
    if (!data) return [];
    const months = Number(trendRange);
    return data.revenueTrend.slice(-months);
  }, [data, trendRange]);

  const categoryChartData = React.useMemo(() => {
    if (!data) return [];
    return data.revenueByCategory.map((row) => ({
      ...row,
      fill: `var(--color-${row.category})`,
    }));
  }, [data]);

  const totalCategoryRevenue = React.useMemo(() => {
    if (!data) return 0;
    return data.revenueByCategory.reduce((sum, r) => sum + r.total, 0);
  }, [data]);

  const paymentChartData = React.useMemo(() => {
    if (!data) return [];
    return data.paymentMethods.map((row) => ({
      method: PAYMENT_METHOD_LABELS[row.method] || row.method,
      count: row.count,
      fill: `var(--color-${PAYMENT_METHOD_LABELS[row.method] || row.method})`,
    }));
  }, [data]);

  const totalPayments = React.useMemo(() => {
    if (!data) return 0;
    return data.paymentMethods.reduce((sum, r) => sum + r.count, 0);
  }, [data]);

  const invoiceChartData = React.useMemo(() => {
    if (!data) return [];
    return data.invoicesByStatus
      .filter((row) => row.count > 0)
      .map((row) => ({
        status: INVOICE_STATUS_LABELS[row.status] || row.status,
        count: row.count,
      }));
  }, [data]);

  return (
    <>
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
                <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.kpis.revenueThisMonth)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.kpis.revenueLastMonth > 0 ? (
                    <span className="flex items-center gap-1">
                      {data.kpis.revenueThisMonth >= data.kpis.revenueLastMonth ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      vs {formatCurrency(data.kpis.revenueLastMonth)} last month
                    </span>
                  ) : (
                    "Completed payments this month"
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <ReceiptText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.kpis.outstanding)}</div>
                <p className="text-xs text-muted-foreground">
                  Unpaid invoices (sent, overdue, partial)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recurring Revenue</CardTitle>
                <Repeat className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.kpis.recurringRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Monthly equivalent from active charges
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpis.collectionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {data.kpis.paidInvoices.toLocaleString()} of{" "}
                  {data.kpis.totalInvoices.toLocaleString()} invoices paid
                </p>
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* Revenue Trend */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        data && (
          <Card>
            <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
              <div className="grid flex-1 gap-1 text-center sm:text-left">
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Monthly completed payments over time</CardDescription>
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
                <ChartContainer config={trendConfig} className="aspect-auto h-[250px] w-full">
                  <AreaChart data={filteredTrend}>
                    <defs>
                      <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.1} />
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
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={formatMonth}
                          formatter={(value) => formatCurrencyFull(Number(value))}
                        />
                      }
                    />
                    <Area
                      dataKey="total"
                      type="monotone"
                      fill="url(#fillRevenue)"
                      stroke="var(--color-total)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  No revenue data available
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}

      {/* Bottom Row: Revenue by Category + Payment Methods */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton className="flex flex-col" />
          <ChartSkeleton className="flex flex-col" />
        </div>
      ) : (
        data && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue by Category */}
            <Card className="flex flex-col">
              <CardHeader className="items-center pb-0">
                <CardTitle>Revenue by Category</CardTitle>
                <CardDescription>Breakdown of paid invoice revenue by source</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-0">
                {categoryChartData.length > 0 ? (
                  <ChartContainer
                    config={categoryConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            hideLabel
                            formatter={(value) => formatCurrencyFull(Number(value))}
                          />
                        }
                      />
                      <Pie
                        data={categoryChartData}
                        dataKey="total"
                        nameKey="category"
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
                                    {formatCurrency(totalCategoryRevenue)}
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
                      <ChartLegend content={<ChartLegendContent />} className="flex-wrap gap-2" />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                    No revenue category data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card className="flex flex-col">
              <CardHeader className="items-center pb-0">
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>How payments are being made</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-0">
                {paymentChartData.length > 0 ? (
                  <ChartContainer
                    config={paymentMethodConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <PieChart>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={paymentChartData}
                        dataKey="count"
                        nameKey="method"
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
                                    {totalPayments.toLocaleString()}
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={(viewBox.cy || 0) + 24}
                                    className="fill-muted-foreground text-xs"
                                  >
                                    Payments
                                  </tspan>
                                </text>
                              );
                            }
                          }}
                        />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent />} className="flex-wrap gap-2" />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                    No payment data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* Invoice Status */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        data && (
          <Card>
            <CardHeader>
              <CardTitle>Invoice Status</CardTitle>
              <CardDescription>Current breakdown of all invoices by status</CardDescription>
            </CardHeader>
            <CardContent>
              {invoiceChartData.length > 0 ? (
                <ChartContainer
                  config={invoiceStatusConfig}
                  className="aspect-auto h-[250px] w-full"
                >
                  <BarChart data={invoiceChartData} layout="vertical">
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      dataKey="status"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={80}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  No invoice data available
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}
    </>
  );
}
