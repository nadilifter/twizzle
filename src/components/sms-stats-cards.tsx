"use client"

import { TrendingUpIcon, TrendingDownIcon, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export interface SmsStatsProps {
  messagesSent: number
  messagesDelivered: number
  messagesFailed: number
  deliveryRate: number
  totalCost: number
  includedMessages: number
  overageMessages: number
  overageCost: number
  overageRate: number | null
  periodEnd: Date | null
  configured: boolean
}

export function SmsStatsCards({ stats }: { stats?: SmsStatsProps }) {
  // Calculate days until renewal
  const daysUntilRenewal = stats?.periodEnd
    ? Math.max(0, Math.ceil((new Date(stats.periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  // Calculate usage percentage
  const usagePercent = stats?.includedMessages
    ? Math.min(100, (stats.messagesSent / stats.includedMessages) * 100)
    : 0

  // Determine if approaching limit
  const isApproachingLimit = usagePercent >= 80
  const isOverLimit = stats?.overageMessages ? stats.overageMessages > 0 : false

  if (!stats?.configured) {
    return (
      <div className="px-4 lg:px-6">
        <Card className="border-dashed">
          <CardHeader className="text-center py-8">
            <CardTitle className="text-lg">SMS Not Configured</CardTitle>
            <CardDescription>
              Configure Twilio credentials in your environment settings to enable SMS messaging.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 px-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 *:data-[slot=card]:shadow-xs *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
      <Card>
        <CardHeader className="relative">
          <CardDescription>Messages Sent</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {stats?.messagesSent?.toLocaleString() ?? 0}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {stats?.messagesDelivered ?? 0} delivered
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats?.messagesFailed ?? 0} failed
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
            {stats?.deliveryRate?.toFixed(1) ?? 0}%
          </CardTitle>
          <div className="absolute right-4 top-4">
            {stats?.deliveryRate && stats.deliveryRate >= 95 ? (
              <Badge variant="outline" className="flex gap-1 rounded-lg text-xs text-green-600">
                <TrendingUpIcon className="size-3" />
                Excellent
              </Badge>
            ) : stats?.deliveryRate && stats.deliveryRate >= 90 ? (
              <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
                Good
              </Badge>
            ) : (
              <Badge variant="outline" className="flex gap-1 rounded-lg text-xs text-amber-600">
                <TrendingDownIcon className="size-3" />
                Needs attention
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats?.messagesSent ? (
              <>
                {stats.messagesDelivered} / {stats.messagesSent} delivered
              </>
            ) : (
              "No messages sent"
            )}
          </div>
          <div className="text-muted-foreground">
            Based on webhook callbacks
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="relative">
          <CardDescription>Estimated Cost</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            ${(stats?.totalCost ?? 0).toFixed(2)}
          </CardTitle>
          <div className="absolute right-4 top-4">
            {isOverLimit && stats?.overageRate ? (
              <span className="text-xs font-mono text-amber-600">
                ${stats.overageRate.toFixed(2)}/overage
              </span>
            ) : (
              <span className="text-xs font-mono text-muted-foreground">
                Included in plan
              </span>
            )}
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {isOverLimit ? (
              <span className="text-amber-600">
                {stats?.overageMessages} overage messages (${stats?.overageCost?.toFixed(2)})
              </span>
            ) : (
              "Within plan limits"
            )}
          </div>
          <div className="text-muted-foreground">Current billing period</div>
        </CardFooter>
      </Card>

      <Card className={isApproachingLimit ? "border-amber-200 dark:border-amber-900" : ""}>
        <CardHeader className="relative">
          <CardDescription>Plan Usage</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {usagePercent.toFixed(1)}%
          </CardTitle>
          <div className="absolute right-4 top-4">
            {isApproachingLimit ? (
              <Badge variant="outline" className="flex gap-1 rounded-lg text-xs text-amber-600 border-amber-300">
                <AlertTriangle className="size-3" />
                {isOverLimit ? "Over limit" : "Near limit"}
              </Badge>
            ) : (
              <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
                {stats?.includedMessages?.toLocaleString() ?? 0} limit
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats?.messagesSent?.toLocaleString() ?? 0} / {stats?.includedMessages?.toLocaleString() ?? 0} used
          </div>
          <div className="text-muted-foreground">
            {daysUntilRenewal !== null ? `Renews in ${daysUntilRenewal} days` : "No plan limit"}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
