import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Users,
  Calendar,
  Globe,
  CreditCard,
  Settings,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { getAuthSession } from "@/lib/auth"
import { getActionItems } from "@/lib/onboarding-actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { ActionItem } from "@/types/onboarding"

const ICON_MAP: Record<string, LucideIcon> = {
  Settings,
  Users,
  Calendar,
  Globe,
  CreditCard,
}

function ActionItemCard({ item }: { item: ActionItem }) {
  const Icon = ICON_MAP[item.icon] ?? Circle

  return (
    <Card className={item.isComplete ? "opacity-60" : ""}>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            item.isComplete
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-primary/10"
          }`}
        >
          {item.isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <Icon className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <CardTitle className="text-base">{item.title}</CardTitle>
          <CardDescription>{item.description}</CardDescription>
        </div>
        <Button
          variant={item.isComplete ? "outline" : "default"}
          size="sm"
          asChild
        >
          <Link href={item.url}>
            {item.isComplete ? "View" : "Get started"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
    </Card>
  )
}

export default async function ActionItemsPage() {
  const session = await getAuthSession()
  if (!session?.user?.organizationId) {
    redirect("/switch-organization")
  }

  const data = await getActionItems(session.user.organizationId)
  const progressPercent = Math.round(
    (data.completedCount / data.totalCount) * 100
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Get started with Uplifter
        </h1>
        <p className="text-muted-foreground">
          Complete these steps to get the most out of your organization.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {data.completedCount} of {data.totalCount} complete
            </span>
            <span className="text-sm text-muted-foreground">
              {progressPercent}%
            </span>
          </div>
          <Progress value={progressPercent} />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {data.items.map((item) => (
          <ActionItemCard key={item.id} item={item} />
        ))}
      </div>

      {data.allComplete && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
          <CardContent className="flex items-center gap-4 pt-6">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-semibold">All set!</p>
              <p className="text-sm text-muted-foreground">
                You&apos;ve completed all the setup steps.{" "}
                <Link
                  href="/dashboard"
                  className="text-primary underline hover:no-underline"
                >
                  Go to your dashboard
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
