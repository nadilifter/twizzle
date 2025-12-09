"use client"

import { TrendingUpIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SmsStatsCards() {
  return (
    <div className="grid gap-4 px-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 *:data-[slot=card]:shadow-xs *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
      <Card>
        <CardHeader className="relative">
          <CardDescription>Messages Sent</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            1,240
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingUpIcon className="size-3" />
              +12.5%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Trending up this month <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            This billing cycle
          </div>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader className="relative">
          <CardDescription>Delivery Rate</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            98.4%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              <TrendingUpIcon className="size-3" />
              +0.2%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Consistent performance <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            +0.2% from last month
          </div>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader className="relative">
          <CardDescription>Estimated Cost</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            $9.80
          </CardTitle>
          <div className="absolute right-4 top-4">
            <span className="text-xs font-mono text-muted-foreground">$0.0079/msg</span>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Within budget
          </div>
          <div className="text-muted-foreground">Current usage</div>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader className="relative">
          <CardDescription>Plan Limit</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            24.8%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              5,000 Cap
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            1,240 / 5,000 used
          </div>
          <div className="text-muted-foreground">Renews in 12 days</div>
        </CardFooter>
      </Card>
    </div>
  )
}


