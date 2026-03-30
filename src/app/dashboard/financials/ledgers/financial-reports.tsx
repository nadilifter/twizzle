"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Layers } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface RevenueByCode {
  id: string;
  code: string;
  description: string;
  amount: number;
}

interface MonthlyRevenue {
  month: string;
  total: number;
}

interface FinancialReportsProps {
  stats: {
    totalRevenue: number;
    totalExpenses: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  monthlyRevenue: MonthlyRevenue[];
  revenueByCode: RevenueByCode[];
}

const monthlyConfig = {
  total: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const revenueByCodeConfig = {
  amount: {
    label: "Amount",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function FinancialReports({ stats, monthlyRevenue, revenueByCode }: FinancialReportsProps) {
  const monthlyData = monthlyRevenue.map((m) => ({
    month: format(new Date(m.month), "MMM"),
    total: m.total,
  }));

  const codeData = revenueByCode.map((rc) => ({
    code: rc.code,
    description: rc.description,
    amount: rc.amount,
  }));

  const netPosition = stats.totalRevenue - stats.totalExpenses;
  const profitMargin = stats.totalRevenue > 0 ? (netPosition / stats.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue (YTD)</CardTitle>
            <CardDescription>Revenue from invoiced line items, by month.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ChartContainer config={monthlyConfig} className="h-[300px] w-full">
                <BarChart data={monthlyData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="total"
                    fill="var(--color-total)"
                    radius={[4, 4, 0, 0]}
                    name="Revenue"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  No monthly revenue data yet.
                  <br />
                  Data will appear as invoices are created.
                </p>
              </div>
            )}
          </CardContent>
          {monthlyData.length > 0 && (
            <CardFooter className="text-sm text-muted-foreground">
              Showing {monthlyData.length} month{monthlyData.length !== 1 ? "s" : ""} of data for{" "}
              {new Date().getFullYear()}
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by GL Code</CardTitle>
            <CardDescription>Total invoiced revenue per GL code.</CardDescription>
          </CardHeader>
          <CardContent>
            {codeData.length > 0 ? (
              <ChartContainer config={revenueByCodeConfig} className="h-[300px] w-full">
                <BarChart data={codeData} layout="vertical">
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="code"
                    type="category"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    width={60}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        }
                        labelFormatter={(_, payload) => {
                          if (payload?.[0]?.payload?.description)
                            return payload[0].payload.description;
                          return _;
                        }}
                      />
                    }
                  />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={4} name="Revenue" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  No GL code revenue data yet.
                </p>
              </div>
            )}
          </CardContent>
          {codeData.length > 0 && (
            <CardFooter className="text-sm text-muted-foreground">
              {codeData.length} GL code{codeData.length !== 1 ? "s" : ""} with recorded revenue
            </CardFooter>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
          <CardDescription>Key metrics computed from your ledger data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Total Revenue</span>
              <span className="text-2xl font-bold">
                $
                {stats.totalRevenue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs text-muted-foreground">From invoiced line items</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Total Expenses</span>
              <span className="text-2xl font-bold">
                $
                {stats.totalExpenses.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs text-muted-foreground">From ledger entries</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Net Position</span>
              <span className="text-2xl font-bold">
                $
                {netPosition.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <div className="flex items-center gap-1">
                {netPosition >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-rose-500" />
                )}
                <span
                  className={`text-xs ${netPosition >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                >
                  Revenue minus expenses
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Profit Margin</span>
              <span className="text-2xl font-bold">
                {stats.totalRevenue > 0 ? `${profitMargin.toFixed(1)}%` : "-"}
              </span>
              <span className="text-xs text-muted-foreground">
                {stats.totalRevenue > 0 ? "Net / Revenue" : "No revenue recorded"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
