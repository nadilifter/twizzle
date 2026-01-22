"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// Mock Data for Profit & Loss (Monthly)
const pnlData = [
  { month: "Jan", revenue: 45000, expenses: 32000, netIncome: 13000 },
  { month: "Feb", revenue: 52000, expenses: 34000, netIncome: 18000 },
  { month: "Mar", revenue: 48000, expenses: 31000, netIncome: 17000 },
  { month: "Apr", revenue: 61000, expenses: 42000, netIncome: 19000 },
  { month: "May", revenue: 55000, expenses: 38000, netIncome: 17000 },
  { month: "Jun", revenue: 67000, expenses: 45000, netIncome: 22000 },
]

const pnlConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--chart-2))",
  },
  netIncome: {
    label: "Net Income",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

// Mock Data for Balance Sheet (Snapshot)
const balanceSheetData = [
  { category: "Assets", amount: 125000, fill: "var(--color-assets)" },
  { category: "Liabilities", amount: 45000, fill: "var(--color-liabilities)" },
  { category: "Equity", amount: 80000, fill: "var(--color-equity)" },
]

const balanceSheetConfig = {
  amount: {
    label: "Amount",
  },
  assets: {
    label: "Assets",
    color: "hsl(var(--chart-1))",
  },
  liabilities: {
    label: "Liabilities",
    color: "hsl(var(--chart-2))",
  },
  equity: {
    label: "Equity",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

export function FinancialReports() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>Profit & Loss (YTD)</CardTitle>
                <CardDescription>
                    Monthly breakdown of Revenue, Expenses, and Net Income.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={pnlConfig} className="h-[300px] w-full">
                    <BarChart data={pnlData}>
                        <CartesianGrid vertical={false} />
                        <XAxis 
                            dataKey="month" 
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} name="Revenue" />
                        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} name="Expenses" />
                        <Bar dataKey="netIncome" fill="var(--color-netIncome)" radius={[4, 4, 0, 0]} name="Net Income" />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Balance Sheet Summary</CardTitle>
                <CardDescription>
                    Current snapshot of Assets vs Liabilities & Equity.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <ChartContainer config={balanceSheetConfig} className="h-[300px] w-full">
                    <BarChart data={balanceSheetData} layout="vertical">
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="category" 
                            type="category" 
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            width={100}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="amount" layout="vertical" radius={4}>
                            {/* We can assign specific colors if needed, or rely on the config if we map it properly in the data or here */}
                        </Bar>
                    </BarChart>
                </ChartContainer>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                    <p>Total Assets: $125,000</p>
                    <p>Total Liabilities + Equity: $125,000</p>
                </div>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Key Performance Indicators</CardTitle>
            <CardDescription>Financial health metrics at a glance.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Net Profit Margin</span>
                    <span className="text-2xl font-bold">32.8%</span>
                    <span className="text-xs text-emerald-500">+2.4% vs last month</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Current Ratio</span>
                    <span className="text-2xl font-bold">2.8</span>
                    <span className="text-xs text-muted-foreground">Healthy (&gt; 1.5)</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Op. Expense Ratio</span>
                    <span className="text-2xl font-bold">67.2%</span>
                    <span className="text-xs text-rose-500">+1.1% vs last month</span>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  )
}


