"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const chartData = [
  { date: "2025-10-01", sent: 400, opened: 180 },
  { date: "2025-10-02", sent: 550, opened: 250 },
  { date: "2025-10-03", sent: 300, opened: 140 },
  { date: "2025-10-04", sent: 600, opened: 290 },
  { date: "2025-10-05", sent: 750, opened: 350 },
  { date: "2025-10-06", sent: 450, opened: 210 },
  { date: "2025-10-07", sent: 900, opened: 420 },
  { date: "2025-10-08", sent: 1200, opened: 580 },
  { date: "2025-10-09", sent: 1000, opened: 480 },
  { date: "2025-10-10", sent: 800, opened: 380 },
  { date: "2025-10-11", sent: 650, opened: 310 },
  { date: "2025-10-12", sent: 400, opened: 190 },
  { date: "2025-10-13", sent: 550, opened: 260 },
  { date: "2025-10-14", sent: 700, opened: 330 },
  { date: "2025-10-15", sent: 950, opened: 450 },
  { date: "2025-10-16", sent: 1100, opened: 520 },
  { date: "2025-10-17", sent: 850, opened: 400 },
  { date: "2025-10-18", sent: 600, opened: 280 },
  { date: "2025-10-19", sent: 500, opened: 240 },
  { date: "2025-10-20", sent: 750, opened: 360 },
  { date: "2025-10-21", sent: 900, opened: 430 },
  { date: "2025-10-22", sent: 1050, opened: 500 },
  { date: "2025-10-23", sent: 800, opened: 380 },
  { date: "2025-10-24", sent: 650, opened: 310 },
  { date: "2025-10-25", sent: 500, opened: 240 },
  { date: "2025-10-26", sent: 700, opened: 330 },
  { date: "2025-10-27", sent: 950, opened: 450 },
  { date: "2025-10-28", sent: 1150, opened: 550 },
  { date: "2025-10-29", sent: 850, opened: 400 },
  { date: "2025-10-30", sent: 600, opened: 290 },
];

const chartConfig = {
  sent: {
    label: "Sent",
    color: "hsl(var(--chart-1))",
  },
  opened: {
    label: "Opened",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function EmailChartAreaInteractive() {
  const [timeRange, setTimeRange] = useState("90d");

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date);
    const now = new Date();
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }
    const startDate = new Date(now.setDate(now.getDate() - daysToSubtract));
    return date >= startDate;
  });

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>Email Engagement</CardTitle>
          <CardDescription>
            Showing total emails sent vs opened for the last 3 months
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[160px] rounded-lg sm:ml-auto" aria-label="Select a value">
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Last 3 months
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sent)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-sent)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillOpened" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-opened)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-opened)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="opened"
              type="natural"
              fill="url(#fillOpened)"
              stroke="var(--color-opened)"
              stackId="a"
            />
            <Area
              dataKey="sent"
              type="natural"
              fill="url(#fillSent)"
              stroke="var(--color-sent)"
              stackId="a"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
