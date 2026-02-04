"use client"

import * as React from "react"
import { Lock, Unlock, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  monthlyPrice: string
  isActive: boolean
}

interface Subscription {
  id: string
  planId: string
  status: string
  billingCycle: string
  isLocked: boolean
  lockedReason: string | null
  currentPeriodStart: string
  currentPeriodEnd: string
  plan: {
    id: string
    name: string
    slug: string
    monthlyPrice: string
  }
}

interface Props {
  organizationId: string
  organizationName: string
  initialSubscription: Subscription | null
}

export function SubscriptionManager({ organizationId, organizationName, initialSubscription }: Props) {
  const [subscription, setSubscription] = React.useState<Subscription | null>(initialSubscription)
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  // Form state
  const [selectedPlanId, setSelectedPlanId] = React.useState(subscription?.planId || "")
  const [billingCycle, setBillingCycle] = React.useState<"MONTHLY" | "YEARLY">(
    (subscription?.billingCycle as "MONTHLY" | "YEARLY") || "MONTHLY"
  )
  const [isLocked, setIsLocked] = React.useState(subscription?.isLocked || false)
  const [lockedReason, setLockedReason] = React.useState(subscription?.lockedReason || "")

  React.useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/superadmin/plans")
      if (!response.ok) throw new Error("Failed to fetch plans")
      const data = await response.json()
      setPlans(data.filter((p: SubscriptionPlan) => p.isActive))
    } catch (error) {
      console.error("Failed to fetch plans:", error)
    }
  }

  const handleOpenDialog = () => {
    setSelectedPlanId(subscription?.planId || "")
    setBillingCycle((subscription?.billingCycle as "MONTHLY" | "YEARLY") || "MONTHLY")
    setIsLocked(subscription?.isLocked || false)
    setLockedReason(subscription?.lockedReason || "")
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (subscription) {
        // Update existing subscription
        const response = await fetch(`/api/superadmin/subscriptions/${subscription.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: selectedPlanId,
            billingCycle,
            isLocked,
            lockedReason: isLocked ? lockedReason : null,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update subscription")
        }

        const updated = await response.json()
        setSubscription(updated)
        toast.success("Subscription updated")
      } else {
        // Create new subscription
        const response = await fetch("/api/superadmin/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            planId: selectedPlanId,
            billingCycle,
            isLocked,
            lockedReason: isLocked ? lockedReason : null,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create subscription")
        }

        const created = await response.json()
        setSubscription(created)
        toast.success("Subscription created")
      }

      setIsDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save subscription")
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleLock = async () => {
    if (!subscription) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/superadmin/subscriptions/${subscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isLocked: !subscription.isLocked,
          lockedReason: !subscription.isLocked ? "Locked by administrator" : null,
        }),
      })

      if (!response.ok) throw new Error("Failed to update")

      const updated = await response.json()
      setSubscription(updated)
      toast.success(updated.isLocked ? "Subscription locked" : "Subscription unlocked")
    } catch (error) {
      toast.error("Failed to update subscription")
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(amount))
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "default"
      case "TRIALING":
        return "secondary"
      case "PAST_DUE":
        return "destructive"
      case "CANCELLED":
        return "outline"
      default:
        return "secondary"
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Manage billing plan for this organization</CardDescription>
          </div>
          <Button variant="outline" onClick={handleOpenDialog}>
            {subscription ? "Change Plan" : "Assign Plan"}
          </Button>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{subscription.plan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(subscription.plan.monthlyPrice)}/{subscription.billingCycle.toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(subscription.status)}>
                    {subscription.status}
                  </Badge>
                  {subscription.isLocked && (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Locked
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Period Start</p>
                  <p>{new Date(subscription.currentPeriodStart).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Period End</p>
                  <p>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
                </div>
              </div>

              {subscription.isLocked && subscription.lockedReason && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-sm">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Lock Reason</p>
                    <p className="text-muted-foreground">{subscription.lockedReason}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleLock}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : subscription.isLocked ? (
                    <Unlock className="mr-2 h-4 w-4" />
                  ) : (
                    <Lock className="mr-2 h-4 w-4" />
                  )}
                  {subscription.isLocked ? "Unlock" : "Lock"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No subscription assigned</p>
              <Button onClick={handleOpenDialog}>Assign Plan</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {subscription ? "Change Subscription" : "Assign Subscription"}
            </DialogTitle>
            <DialogDescription>
              {subscription
                ? `Update the subscription for ${organizationName}`
                : `Assign a billing plan to ${organizationName}`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(plan.monthlyPrice)}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Billing Cycle</Label>
              <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as "MONTHLY" | "YEARLY")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Lock Subscription</Label>
                <p className="text-sm text-muted-foreground">
                  Prevent organization from changing their plan
                </p>
              </div>
              <Switch checked={isLocked} onCheckedChange={setIsLocked} />
            </div>

            {isLocked && (
              <div className="space-y-2">
                <Label>Lock Reason (shown to org admins)</Label>
                <Input
                  value={lockedReason}
                  onChange={(e) => setLockedReason(e.target.value)}
                  placeholder="e.g., Contract commitment until Dec 2025"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !selectedPlanId}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {subscription ? "Update" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
