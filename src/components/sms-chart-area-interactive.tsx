"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState } from "react"

const chartData = [
  { date: "2025-10-01", sent: 40, delivered: 38 },
  { date: "2025-10-02", sent: 55, delivered: 52 },
  { date: "2025-10-03", sent: 30, delivered: 29 },
  { date: "2025-10-04", sent: 60, delivered: 58 },
  { date: "2025-10-05", sent: 75, delivered: 70 },
  { date: "2025-10-06", sent: 45, delivered: 43 },
  { date: "2025-10-07", sent: 90, delivered: 88 },
  { date: "2025-10-08", sent: 120, delivered: 115 },
  { date: "2025-10-09", sent: 100, delivered: 98 },
  { date: "2025-10-10", sent: 80, delivered: 78 },
  { date: "2025-10-11", sent: 65, delivered: 62 },
  { date: "2025-10-12", sent: 40, delivered: 39 },
  { date: "2025-10-13", sent: 55, delivered: 54 },
  { date: "2025-10-14", sent: 70, delivered: 68 },
  { date: "2025-10-15", sent: 95, delivered: 92 },
  { date: "2025-10-16", sent: 110, delivered: 108 },
  { date: "2025-10-17", sent: 85, delivered: 82 },
  { date: "2025-10-18", sent: 60, delivered: 59 },
  { date: "2025-10-19", sent: 50, delivered: 48 },
  { date: "2025-10-20", sent: 75, delivered: 72 },
  { date: "2025-10-21", sent: 90, delivered: 87 },
  { date: "2025-10-22", sent: 105, delivered: 102 },
  { date: "2025-10-23", sent: 80, delivered: 78 },
  { date: "2025-10-24", sent: 65, delivered: 63 },
  { date: "2025-10-25", sent: 50, delivered: 48 },
  { date: "2025-10-26", sent: 70, delivered: 68 },
  { date: "2025-10-27", sent: 95, delivered: 93 },
  { date: "2025-10-28", sent: 115, delivered: 110 },
  { date: "2025-10-29", sent: 85, delivered: 83 },
  { date: "2025-10-30", sent: 60, delivered: 58 },
]

const chartConfig = {
  sent: {
    label: "Sent",
    color: "hsl(var(--chart-1))",
  },
  delivered: {
    label: "Delivered",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function SmsChartAreaInteractive() {
  const [timeRange, setTimeRange] = useState("90d")

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const now = new Date()
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(now.setDate(now.getDate() - daysToSubtract))
    return date >= startDate
  })

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>SMS Volume</CardTitle>
          <CardDescription>
            Showing total messages sent vs delivered for the last 3 months
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
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
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-sent)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-sent)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-delivered)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-delivered)"
                  stopOpacity={0.1}
                />
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
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
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
                    })
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
  )
}


