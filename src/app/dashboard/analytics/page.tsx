"use client"

import * as React from "react"
import { TrendingUp, Users, Medal, Trophy, Activity } from "lucide-react"
import { Label, Pie, PieChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList, Area, AreaChart, Line, LineChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Mock Data
const ageData = [
  { ageRange: "under6", participants: 150, fill: "var(--color-under6)" },
  { ageRange: "7-12", participants: 320, fill: "var(--color-7-12)" },
  { ageRange: "13-17", participants: 210, fill: "var(--color-13-17)" },
  { ageRange: "18-30", participants: 180, fill: "var(--color-18-30)" },
  { ageRange: "30-45", participants: 120, fill: "var(--color-30-45)" },
  { ageRange: "45plus", participants: 80, fill: "var(--color-45plus)" },
]

const genderData = [
  { gender: "female", participants: 650, fill: "var(--color-female)" },
  { gender: "male", participants: 380, fill: "var(--color-male)" },
  { gender: "undisclosed", participants: 30, fill: "var(--color-undisclosed)" },
  { gender: "unknown", participants: 15, fill: "var(--color-unknown)" },
]

// Weekly New vs Lost Participants Data
const weeklyParticipantData = [
  { week: "Week 1", new: 12, lost: 4 },
  { week: "Week 2", new: 18, lost: 6 },
  { week: "Week 3", new: 15, lost: 3 },
  { week: "Week 4", new: 22, lost: 5 },
  { week: "Week 5", new: 28, lost: 8 },
  { week: "Week 6", new: 24, lost: 4 },
  { week: "Week 7", new: 30, lost: 7 },
  { week: "Week 8", new: 26, lost: 5 },
]

const levelData = [
  { level: "Level 1-3 (Beg)", students: 450, fill: "var(--color-beg)" },
  { level: "Level 4-6 (Int)", students: 320, fill: "var(--color-int)" },
  { level: "Level 7-9 (Adv)", students: 180, fill: "var(--color-adv)" },
  { level: "Level 10/Elite", students: 40, fill: "var(--color-elite)" },
]

// US Standard Achievement Mock Data (Retention/Pass rates)
const achievementData = [
  { level: "Lvl 1", rate: 95 },
  { level: "Lvl 2", rate: 92 },
  { level: "Lvl 3", rate: 88 },
  { level: "Lvl 4", rate: 82 },
  { level: "Lvl 5", rate: 75 },
  { level: "Lvl 6", rate: 68 },
  { level: "Lvl 7", rate: 60 },
  { level: "Lvl 8", rate: 50 },
  { level: "Lvl 9", rate: 40 },
  { level: "Lvl 10", rate: 25 },
]

// Chart Configs
const ageConfig = {
  participants: {
    label: "Participants",
  },
  under6: {
    label: "Under 6",
    color: "hsl(var(--chart-1))",
  },
  "7-12": {
    label: "7-12",
    color: "hsl(var(--chart-2))",
  },
  "13-17": {
    label: "13-17",
    color: "hsl(var(--chart-3))",
  },
  "18-30": {
    label: "18-30",
    color: "hsl(var(--chart-4))",
  },
  "30-45": {
    label: "30-45",
    color: "hsl(var(--chart-5))",
  },
  "45plus": {
    label: "45+",
    color: "hsl(var(--chart-6))",
  },
} satisfies ChartConfig

const genderConfig = {
  participants: {
    label: "Participants",
  },
  female: {
    label: "Female",
    color: "hsl(var(--chart-1))",
  },
  male: {
    label: "Male",
    color: "hsl(var(--chart-2))",
  },
  undisclosed: {
    label: "Undisclosed",
    color: "hsl(var(--chart-3))",
  },
  unknown: {
    label: "Unknown",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig

const weeklyParticipantConfig = {
  visitors: {
    label: "Participants",
  },
  new: {
    label: "New Participants",
    color: "hsl(var(--chart-1))",
  },
  lost: {
    label: "Lost Participants",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const levelConfig = {
  students: {
    label: "Students",
  },
  beg: {
    label: "Beginner",
    color: "hsl(var(--chart-1))",
  },
  int: {
    label: "Intermediate",
    color: "hsl(var(--chart-2))",
  },
  adv: {
    label: "Advanced",
    color: "hsl(var(--chart-3))",
  },
  elite: {
    label: "Elite",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig

const achievementConfig = {
  rate: {
    label: "Pass Rate %",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function AnalyticsPage() {
  // Calculate Total Participants from ageData or just sum it up
  const totalParticipants = React.useMemo(() => {
    return ageData.reduce((acc, curr) => acc + curr.participants, 0)
  }, [])

  const [timeRange, setTimeRange] = React.useState("90d")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Overview of program performance
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParticipants.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">Currently in session</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Elite Athletes</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">40</div>
            <p className="text-xs text-muted-foreground">Level 10 & Elite</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Competition Wins</CardTitle>
            <Medal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">This season</p>
          </CardContent>
        </Card>
      </div>

      {/* Demographics Row */}
      <div className="grid gap-4 md:grid-cols-2">
        
        {/* Participants by Age - Donut with Text */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Participants by Age</CardTitle>
            <CardDescription>Current enrollment by age group</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={ageConfig}
              className="mx-auto aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={ageData}
                  dataKey="participants"
                  nameKey="ageRange"
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
                              {totalParticipants.toLocaleString()}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground text-xs"
                            >
                              Participants
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent />} className="flex-wrap gap-2" />
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 font-medium leading-none">
              Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
            </div>
            <div className="leading-none text-muted-foreground">
              Showing total participants by age group
            </div>
          </CardFooter>
        </Card>

        {/* Participants by Gender - Donut with Text */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Participants by Gender</CardTitle>
            <CardDescription>Distribution by gender</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={genderConfig}
              className="mx-auto aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={genderData}
                  dataKey="participants"
                  nameKey="gender"
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
                              {totalParticipants.toLocaleString()}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
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
                <ChartLegend content={<ChartLegendContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
           <CardFooter className="flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 font-medium leading-none">
              Most participants identify as Female <TrendingUp className="h-4 w-4" />
            </div>
            <div className="leading-none text-muted-foreground">
              Showing gender distribution
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Weekly Participant Churn - Replaced with Total Visitors Style */}
      <Card>
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
          <div className="grid flex-1 gap-1 text-center sm:text-left">
            <CardTitle>Weekly Participant Churn</CardTitle>
            <CardDescription>
              New vs Lost Participants over the last 8 weeks
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
          <ChartContainer config={weeklyParticipantConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={weeklyParticipantData}>
              <defs>
                <linearGradient id="fillNew" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-new)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-new)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillLost" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-lost)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-lost)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => value}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => value}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="lost"
                type="natural"
                fill="url(#fillLost)"
                stroke="var(--color-lost)"
                stackId="a"
              />
              <Area
                dataKey="new"
                type="natural"
                fill="url(#fillNew)"
                stroke="var(--color-new)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Gymnastics Specific Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Program Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Program Level Distribution</CardTitle>
            <CardDescription>Students by USAG Level Groups</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={levelConfig} className="max-h-[250px] w-full">
              <BarChart
                accessibilityLayer
                data={levelData}
                layout="vertical"
                margin={{
                  left: 0,
                }}
              >
                <YAxis
                  dataKey="level"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value} // Might need truncation if too long
                  width={100}
                />
                <XAxis type="number" dataKey="students" hide />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar dataKey="students" layout="vertical" radius={5} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Achievement Rate by Level */}
        <Card>
          <CardHeader>
            <CardTitle>Pass Rate by Level</CardTitle>
            <CardDescription>US Standard Achievement Rates</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={achievementConfig} className="max-h-[250px] w-full">
              <AreaChart
                accessibilityLayer
                data={achievementData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="level"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="rate"
                  type="natural"
                  fill="var(--color-rate)"
                  fillOpacity={0.4}
                  stroke="var(--color-rate)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
          <CardFooter>
             <div className="flex w-full items-start gap-2 text-sm">
              <div className="grid gap-2">
                <div className="flex items-center gap-2 font-medium leading-none">
                  Difficulty increases significantly at Level 7 <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 leading-none text-muted-foreground">
                  Percentage of students passing to next level
                </div>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
