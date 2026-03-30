"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Loader2Icon } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { useVisitorMetrics, DailyVisitorCount } from "@/hooks/use-visitor-metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-analytics-1))",
  },
  mobile: {
    label: "Mobile",
    color: "hsl(var(--chart-analytics-3))",
  },
} satisfies ChartConfig;

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Get date range for a time period
function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

// Map time range to days
function getDaysFromRange(timeRange: string): number {
  switch (timeRange) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    default:
      return 30;
  }
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("30d");

  // Calculate date range based on selected time period
  const dateRange = React.useMemo(() => {
    const days = getDaysFromRange(timeRange);
    return getDateRange(days);
  }, [timeRange]);

  // Fetch real visitor data
  const { data, loading, error } = useVisitorMetrics({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  // Transform data for the chart
  const chartData: DailyVisitorCount[] = data?.daily || [];

  // Calculate totals for the description
  const totalVisitors = data?.total || 0;
  const totalDesktop = data?.totalDesktop || 0;
  const totalMobile = data?.totalMobile || 0;

  // Get description text based on time range
  const getDescriptionText = () => {
    if (loading) return "Loading...";
    if (error) return "Analytics not configured";
    if (totalVisitors === 0) return "No visitor data yet";

    const desktopPercent = totalVisitors > 0 ? Math.round((totalDesktop / totalVisitors) * 100) : 0;
    const mobilePercent = totalVisitors > 0 ? Math.round((totalMobile / totalVisitors) * 100) : 0;

    return `${totalVisitors.toLocaleString()} visitors (${desktopPercent}% desktop, ${mobilePercent}% mobile)`;
  };

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Total Visitors</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">{getDescriptionText()}</span>
          <span className="@[540px]/card:hidden">
            {loading ? "Loading..." : `${totalVisitors.toLocaleString()} visitors`}
          </span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(value) => value && setTimeRange(value)}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="90d" className="h-8 px-2.5">
              Last 3 months
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="h-8 px-2.5">
              Last 30 days
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5">
              Last 7 days
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="@[767px]/card:hidden flex w-40" aria-label="Select a value">
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
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <div className="flex h-[250px] items-center justify-center">
            <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No visitor data available for this period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-desktop)" stopOpacity={1.0} />
                  <stop offset="95%" stopColor="var(--color-desktop)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-mobile)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-mobile)" stopOpacity={0.1} />
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
                dataKey="mobile"
                type="natural"
                fill="url(#fillMobile)"
                stroke="var(--color-mobile)"
                stackId="a"
              />
              <Area
                dataKey="desktop"
                type="natural"
                fill="url(#fillDesktop)"
                stroke="var(--color-desktop)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
