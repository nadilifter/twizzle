"use client";

import { useMemo } from "react";
import { TrendingDownIcon, TrendingUpIcon, UsersIcon, CalendarIcon, Loader2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useVisitorMetrics } from "@/hooks/use-visitor-metrics";

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Get date range for last N days
function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

export function SectionCards() {
  return (
    <div className="grid gap-4 px-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 *:data-[slot=card]:shadow-xs *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
      <TodayVisitorsCard />
      <TotalVisitorsCard />
      <Card>
        <CardHeader className="relative">
          <CardDescription>New Customers</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            1,234
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingDownIcon className="size-3" />
              -20%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Down 20% this period <TrendingDownIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Acquisition needs attention
          </div>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader className="relative">
          <CardDescription>Growth Rate</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            4.5%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingUpIcon className="size-3" />
              +4.5%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Steady performance <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Meets growth projections</div>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Today's visitors card - shows daily count with day-over-day comparison
 */
function TodayVisitorsCard() {
  const { data, loading, error } = useVisitorMetrics();

  const todayCount = data?.today ?? 0;
  const percentChange = data?.percentChange ?? null;
  const isPositive = percentChange !== null && percentChange >= 0;
  const TrendIcon = isPositive ? TrendingUpIcon : TrendingDownIcon;

  // Format the visitor count with commas
  const formattedCount = todayCount.toLocaleString();

  // Get a friendly description
  const getFooterText = () => {
    if (loading) return "Loading visitor data...";
    if (error) return "Analytics not configured";
    if (todayCount === 0 && data?.yesterday === 0) return "No visitors tracked yet";
    if (percentChange === null) return "Tracking started today";
    if (percentChange > 0) return "More visitors than yesterday";
    if (percentChange < 0) return "Fewer visitors than yesterday";
    return "Same as yesterday";
  };

  return (
    <Card>
      <CardHeader className="relative">
        <CardDescription className="flex items-center gap-2">
          <UsersIcon className="size-4" />
          Today&apos;s Visitors
        </CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {loading ? (
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          ) : (
            formattedCount
          )}
        </CardTitle>
        {!loading && percentChange !== null && (
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendIcon className="size-3" />
              {isPositive ? "+" : ""}{percentChange}%
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {getFooterText()}
          {!loading && percentChange !== null && <TrendIcon className="size-4" />}
        </div>
        <div className="text-muted-foreground">
          {loading ? "Fetching analytics..." : `${data?.total?.toLocaleString() ?? 0} visitors this week`}
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * Total visitors card - shows monthly total with month-over-month comparison
 */
function TotalVisitorsCard() {
  // Get date ranges for current month (last 30 days) and previous month
  const dateRanges = useMemo(() => {
    const currentMonth = getDateRange(30);
    const prevEnd = new Date();
    prevEnd.setDate(prevEnd.getDate() - 30);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 29);
    return {
      current: currentMonth,
      previous: {
        startDate: formatDate(prevStart),
        endDate: formatDate(prevEnd),
      },
    };
  }, []);

  // Fetch current month data
  const { data: currentData, loading: currentLoading } = useVisitorMetrics({
    startDate: dateRanges.current.startDate,
    endDate: dateRanges.current.endDate,
  });

  // Fetch previous month data for comparison
  const { data: prevData, loading: prevLoading } = useVisitorMetrics({
    startDate: dateRanges.previous.startDate,
    endDate: dateRanges.previous.endDate,
  });

  const loading = currentLoading || prevLoading;
  const currentTotal = currentData?.total ?? 0;
  const prevTotal = prevData?.total ?? 0;

  // Calculate month-over-month change
  let percentChange: number | null = null;
  if (prevTotal > 0) {
    percentChange = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
  } else if (currentTotal > 0) {
    percentChange = 100;
  }

  const isPositive = percentChange !== null && percentChange >= 0;
  const TrendIcon = isPositive ? TrendingUpIcon : TrendingDownIcon;

  // Calculate daily average
  const dailyAverage = currentData?.daily?.length
    ? Math.round(currentTotal / currentData.daily.length)
    : 0;

  const getFooterText = () => {
    if (loading) return "Loading analytics...";
    if (currentTotal === 0) return "No visitors tracked yet";
    if (percentChange === null) return "First month of tracking";
    if (percentChange > 0) return "Growing month over month";
    if (percentChange < 0) return "Declining from last month";
    return "Stable traffic";
  };

  return (
    <Card>
      <CardHeader className="relative">
        <CardDescription className="flex items-center gap-2">
          <CalendarIcon className="size-4" />
          Total Visitors
        </CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {loading ? (
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          ) : (
            currentTotal.toLocaleString()
          )}
        </CardTitle>
        {!loading && percentChange !== null && (
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendIcon className="size-3" />
              {isPositive ? "+" : ""}{percentChange}%
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {getFooterText()}
          {!loading && percentChange !== null && <TrendIcon className="size-4" />}
        </div>
        <div className="text-muted-foreground">
          {loading ? "Calculating..." : `~${dailyAverage.toLocaleString()} daily avg (last 30 days)`}
        </div>
      </CardFooter>
    </Card>
  );
}
