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
import { useMemo, useState } from "react";

export interface SmsChartDataPoint {
  date: string;
  sent: number;
  delivered: number;
}

interface SmsChartAreaInteractiveProps {
  data?: SmsChartDataPoint[];
}

const chartConfig = {
  sent: {
    label: "Sent",
    color: "hsl(var(--chart-1))",
  },
  delivered: {
    label: "Delivered",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function SmsChartAreaInteractive({ data = [] }: SmsChartAreaInteractiveProps) {
  const [timeRange, setTimeRange] = useState("30d");

  const filteredData = useMemo(() => {
    if (data.length === 0) return [];

    const now = new Date();
    let daysToSubtract = 30;
    if (timeRange === "90d") {
      daysToSubtract = 90;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);

    return data.filter((item) => new Date(item.date) >= startDate);
  }, [data, timeRange]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>SMS Volume</CardTitle>
          <CardDescription>Messages sent vs delivered over time</CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[160px] rounded-lg sm:ml-auto" aria-label="Select a value">
            <SelectValue placeholder="Last 30 days" />
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
              <linearGradient id="fillDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-delivered)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-delivered)" stopOpacity={0.1} />
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
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={30} />
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
              dataKey="delivered"
              type="natural"
              fill="url(#fillDelivered)"
              stroke="var(--color-delivered)"
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
