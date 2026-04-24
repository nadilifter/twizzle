"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Loader2, DollarSign } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, Pie, PieChart, Cell, Label } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { toast } from "sonner";

interface FinancialOverview {
  revenue: {
    current: number;
    previous: number;
    changePercent: string;
    transactionCount: number;
    byMonth: Array<{ month: string; revenue: number }>;
    breakdown: Array<{ category: string; amount: number }>;
  };
  payouts: {
    pending: number;
    pendingCount: number;
    pendingBalance: number | null;
    liveBalance: {
      available: number;
      pending: number;
      reserved: number;
      balance: number;
      currency: string;
    } | null;
    nextScheduled: string | null;
    netThisMonth: number;
    netYTD: number;
  };
  summary: {
    grossThisMonth: number;
    feesThisMonth: number;
    netThisMonth: number;
    grossYTD: number;
    feesYTD: number;
    netYTD: number;
  };
  subscriptions: {
    active: number;
  };
  invoices: {
    outstanding: number;
    outstandingCount: number;
    byStatus: Array<{ status: string; count: number; total: number }>;
  };
  transactions: {
    settledThisMonth: number;
    settledCount: number;
  };
  adyenStatus: {
    status: string;
    verificationComplete: boolean;
  };
  fees: {
    thisMonth: number;
  };
}

const revenueConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const breakdownConfig = {
  amount: { label: "Amount" },
  membership: { label: "Membership", color: "hsl(var(--chart-1))" },
  merchandise: { label: "Merchandise", color: "hsl(var(--chart-2))" },
  events: { label: "Events", color: "hsl(var(--chart-3))" },
  lessons: { label: "Private Lessons", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

export default function FinancialsPage() {
  const [data, setData] = React.useState<FinancialOverview | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchOverview() {
      try {
        const response = await fetch("/api/financials/overview");
        if (!response.ok) throw new Error("Failed to fetch financial overview");

        const overview = await response.json();
        setData(overview);
      } catch (error) {
        console.error("Error fetching financial overview:", error);
        toast.error("Failed to load financial data");
      } finally {
        setLoading(false);
      }
    }

    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Prepare chart data
  const revenueData = data?.revenue.byMonth ?? [];

  const breakdownData =
    data?.revenue.breakdown.map((item) => ({
      category: item.category,
      amount: item.amount,
      fill: `var(--color-${item.category})`,
    })) || [];

  const totalRevenue = data?.revenue.current || 0;
  const revenueChange = parseFloat(data?.revenue.changePercent || "0");
  const isPositiveChange = revenueChange >= 0;

  const feesThisMonth = data?.fees.thisMonth ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Financial Overview</h1>
        <p className="text-muted-foreground">
          Manage your club&apos;s financial health, transactions, and Adyen onboarding status.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {totalRevenue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p
              className={`text-xs ${isPositiveChange ? "text-green-600" : "text-red-600"} flex items-center`}
            >
              {isPositiveChange ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {isPositiveChange ? "+" : ""}
              {revenueChange}% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {(data?.payouts.pending || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.payouts.pendingCount || 0} pending
            </p>
            {data?.payouts.pendingBalance != null && (
              <p className="text-xs text-muted-foreground mt-1">
                $
                {data.payouts.pendingBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                awaiting settlement
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              $
              {(data?.payouts.netThisMonth || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              net paid this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adyen Status</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${data?.adyenStatus.verificationComplete ? "text-green-600" : "text-yellow-600"} flex items-center gap-2`}
            >
              {data?.adyenStatus.verificationComplete ? "Active" : "Pending"}
              {data?.adyenStatus.verificationComplete && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.adyenStatus.verificationComplete
                ? "Account verification complete"
                : "Verification pending"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.subscriptions.active || 0}</div>
            <p className="text-xs text-muted-foreground">Recurring charges</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Fees Deducted</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {feesThisMonth.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Deducted from transactions this month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Monthly revenue for the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={revenueConfig} className="min-h-[300px] w-full">
              <BarChart data={revenueData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
            <CardDescription>Revenue distribution by category.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={breakdownConfig}
              className="mx-auto aspect-square max-h-[300px]"
            >
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={breakdownData}
                  dataKey="amount"
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
                              ${(totalRevenue / 1000).toFixed(1)}k
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground text-sm"
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
                  content={<ChartLegendContent nameKey="category" />}
                  className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 font-medium leading-none">
              {isPositiveChange ? "Trending up" : "Trending down"} by {Math.abs(revenueChange)}%
              this month
              {isPositiveChange ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
            <div className="leading-none text-muted-foreground">
              Showing total revenue distribution for the current period
            </div>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout Summary</CardTitle>
          <CardDescription>
            Earnings, fees, and net payouts for the current month and year to date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium pb-3 w-1/2"></th>
                <th className="text-right font-medium pb-3">This Month</th>
                <th className="text-right font-medium pb-3">YTD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 text-muted-foreground">Gross Earnings</td>
                <td className="py-2 text-right">
                  $
                  {(data?.summary.grossThisMonth || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-2 text-right">
                  $
                  {(data?.summary.grossYTD || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Platform Fees</td>
                <td className="py-2 text-right text-muted-foreground">
                  −$
                  {(data?.summary.feesThisMonth || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  −$
                  {(data?.summary.feesYTD || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
              <tr className="border-t">
                <td className="pt-3 pb-1 font-medium">Net Paid Out</td>
                <td className="pt-3 pb-1 text-right font-medium">
                  $
                  {(data?.summary.netThisMonth || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="pt-3 pb-1 text-right font-medium">
                  $
                  {(data?.summary.netYTD || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Net reflects settled payouts; gross reflects collected payments.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
