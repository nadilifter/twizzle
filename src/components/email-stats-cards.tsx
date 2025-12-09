"use client"

import { TrendingUpIcon, TrendingDownIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function EmailStatsCards() {
  return (
    <div className="grid gap-4 px-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 *:data-[slot=card]:shadow-xs *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
      <Card>
        <CardHeader className="relative">
          <CardDescription>Emails Sent</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            15,240
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingUpIcon className="size-3" />
              +24.5%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            High volume period <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Last 30 days
          </div>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader className="relative">
          <CardDescription>Open Rate</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            42.8%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingUpIcon className="size-3" />
              +1.2%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Above industry avg <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Unique opens
          </div>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader className="relative">
          <CardDescription>Click Rate</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            3.2%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingDownIcon className="size-3" />
              -0.4%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Slight dip <TrendingDownIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Unique clicks</div>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader className="relative">
          <CardDescription>Bounce Rate</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            0.8%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs text-green-600 border-green-600">
              Healthy
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Reputation strong
          </div>
          <div className="text-muted-foreground">Hard bounces &lt; 1%</div>
        </CardFooter>
      </Card>
    </div>
  )
}


