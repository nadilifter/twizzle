"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface Plan {
  id: string
  name: string
  slug: string
  monthlyPrice: number
  yearlyPrice: number | null
  transactionFee: number
  perTransactionFee: number
  maxAthletes: number | null
  maxUsers: number | null
  maxPrograms: number | null
  maxEvents: number | null
  smsIncluded: number | null
  emailIncluded: number | null
  maxStorageMB: number | null
  maxMembershipTypes: number | null
  features: string[]
  isPopular: boolean
}

interface Props {
  currentPlanId: string | null
  plans: Plan[]
  currentUsage: {
    athletes: number
    users: number
    programs: number
    events: number
    storageMB?: number
    membershipTypes?: number
  }
  billingCycle: string
  variant?: "default" | "compact"
  targetPlanId?: string
}

export function PlanSelector({ 
  currentPlanId, 
  plans, 
  currentUsage, 
  billingCycle: initialBillingCycle,
  variant = "default",
  targetPlanId
}: Props) {
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [selectedPlanId, setSelectedPlanId] = React.useState(targetPlanId || currentPlanId || "")
  const [billingCycle, setBillingCycle] = React.useState<"MONTHLY" | "YEARLY">(
    initialBillingCycle as "MONTHLY" | "YEARLY"
  )
  const [isSaving, setIsSaving] = React.useState(false)

  const selectedPlan = plans.find(p => p.id === selectedPlanId)
  
  // Check if selected plan would exceed limits
  const limitWarnings: string[] = []
  if (selectedPlan) {
    if (selectedPlan.maxAthletes && currentUsage.athletes > selectedPlan.maxAthletes) {
      limitWarnings.push(`This plan allows ${selectedPlan.maxAthletes} athletes, but you have ${currentUsage.athletes}`)
    }
    if (selectedPlan.maxUsers && currentUsage.users > selectedPlan.maxUsers) {
      limitWarnings.push(`This plan allows ${selectedPlan.maxUsers} users, but you have ${currentUsage.users}`)
    }
    if (selectedPlan.maxPrograms && currentUsage.programs > selectedPlan.maxPrograms) {
      limitWarnings.push(`This plan allows ${selectedPlan.maxPrograms} programs, but you have ${currentUsage.programs}`)
    }
    if (selectedPlan.maxEvents && currentUsage.events > selectedPlan.maxEvents) {
      limitWarnings.push(`This plan allows ${selectedPlan.maxEvents} events, but you have ${currentUsage.events}`)
    }
    if (selectedPlan.maxStorageMB && currentUsage.storageMB && currentUsage.storageMB > selectedPlan.maxStorageMB) {
      const usedGB = (currentUsage.storageMB / 1000).toFixed(1)
      const limitGB = (selectedPlan.maxStorageMB / 1000).toFixed(1)
      limitWarnings.push(`This plan allows ${limitGB} GB storage, but you're using ${usedGB} GB`)
    }
    if (selectedPlan.maxMembershipTypes && currentUsage.membershipTypes && currentUsage.membershipTypes > selectedPlan.maxMembershipTypes) {
      limitWarnings.push(`This plan allows ${selectedPlan.maxMembershipTypes} membership types, but you have ${currentUsage.membershipTypes}`)
    }
  }

  const handleOpenDialog = () => {
    setSelectedPlanId(targetPlanId || currentPlanId || "")
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (limitWarnings.length > 0) {
      toast.error("Please reduce your usage before switching to this plan")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/organization/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          billingCycle,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to change plan")
      }

      toast.success("Plan updated successfully!")
      setIsDialogOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change plan")
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const formatPercent = (amount: number) => {
    return `${(amount * 100).toFixed(1)}%`
  }

  if (variant === "compact") {
    return (
      <>
        <Button variant="outline" size="sm" onClick={handleOpenDialog}>
          Select
        </Button>
        <PlanDialog />
      </>
    )
  }

  return (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={handleOpenDialog}>
        Change Plan
      </Button>
      <PlanDialog />
    </>
  )

  function PlanDialog() {
    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Select a new plan for your organization
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
                      <div className="flex items-center gap-2">
                        {plan.name} - {formatCurrency(plan.monthlyPrice)}/mo
                        {plan.isPopular && (
                          <Badge variant="secondary" className="ml-2">Popular</Badge>
                        )}
                        {plan.id === currentPlanId && (
                          <Badge variant="outline" className="ml-2">Current</Badge>
                        )}
                      </div>
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
                  <SelectItem value="YEARLY">
                    Yearly {selectedPlan?.yearlyPrice ? `(${formatCurrency(selectedPlan.yearlyPrice)})` : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedPlan && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium">Plan Details</h4>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-medium">
                        {formatCurrency(billingCycle === "YEARLY" && selectedPlan.yearlyPrice 
                          ? selectedPlan.yearlyPrice 
                          : selectedPlan.monthlyPrice * (billingCycle === "YEARLY" ? 12 : 1)
                        )}/{billingCycle.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction Fee</span>
                      <span className="font-medium">
                        {formatPercent(selectedPlan.transactionFee)} + {formatCurrency(selectedPlan.perTransactionFee)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Athletes</span>
                      <span className="font-medium">
                        {selectedPlan.maxAthletes || "Unlimited"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Users</span>
                      <span className="font-medium">
                        {selectedPlan.maxUsers || "Unlimited"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Programs</span>
                      <span className="font-medium">
                        {selectedPlan.maxPrograms || "Unlimited"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SMS/month</span>
                      <span className="font-medium">
                        {selectedPlan.smsIncluded || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Emails/month</span>
                      <span className="font-medium">
                        {selectedPlan.emailIncluded || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Storage</span>
                      <span className="font-medium">
                        {selectedPlan.maxStorageMB 
                          ? (selectedPlan.maxStorageMB >= 1000 
                              ? `${selectedPlan.maxStorageMB / 1000} GB` 
                              : `${selectedPlan.maxStorageMB} MB`)
                          : "Unlimited"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Membership Types</span>
                      <span className="font-medium">
                        {selectedPlan.maxMembershipTypes || "Unlimited"}
                      </span>
                    </div>
                  </div>

                  {selectedPlan.features.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h5 className="text-sm font-medium text-muted-foreground">Features</h5>
                      {selectedPlan.features.slice(0, 5).map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                      {selectedPlan.features.length > 5 && (
                        <p className="text-sm text-muted-foreground">
                          +{selectedPlan.features.length - 5} more features
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {limitWarnings.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Cannot switch to this plan</span>
                </div>
                <ul className="text-sm text-destructive/90 list-disc list-inside">
                  {limitWarnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !selectedPlanId || selectedPlanId === currentPlanId || limitWarnings.length > 0}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
}
