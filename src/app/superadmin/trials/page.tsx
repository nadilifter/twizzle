"use client"

import * as React from "react"
import Link from "next/link"
import { 
  Timer,
  MoreHorizontal,
  Loader2,
  Building2,
  AlertTriangle,
  CalendarClock,
  Users,
  Play,
  ArrowRightLeft,
  ExternalLink,
  Mail,
} from "lucide-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"

interface TrialSubscription {
  id: string
  organizationId: string
  planId: string
  status: string
  createdAt: string
  trialEndsAt: string | null
  organization: {
    id: string
    name: string
    slug: string
  }
  plan: {
    id: string
    name: string
    slug: string
    monthlyPrice: string
  }
  adminContact?: {
    id: string
    name: string | null
    email: string
  } | null
}

interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  monthlyPrice: string
  isActive: boolean
}

export default function TrialsPage() {
  const [trials, setTrials] = React.useState<TrialSubscription[]>([])
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isActionLoading, setIsActionLoading] = React.useState(false)

  // Dialog state
  const [selectedTrial, setSelectedTrial] = React.useState<TrialSubscription | null>(null)
  const [isEndTrialDialogOpen, setIsEndTrialDialogOpen] = React.useState(false)
  const [isChangePlanDialogOpen, setIsChangePlanDialogOpen] = React.useState(false)
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>("")

  React.useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [trialsRes, plansRes] = await Promise.all([
        fetch("/api/superadmin/trials"),
        fetch("/api/superadmin/plans")
      ])
      
      if (!trialsRes.ok) throw new Error("Failed to fetch trials")
      if (!plansRes.ok) throw new Error("Failed to fetch plans")
      
      const trialsData = await trialsRes.json()
      const plansData = await plansRes.json()
      
      setTrials(trialsData)
      setPlans(plansData.filter((p: SubscriptionPlan) => p.isActive))
    } catch (error) {
      toast.error("Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndTrial = async () => {
    if (!selectedTrial) return
    
    setIsActionLoading(true)
    try {
      const response = await fetch(`/api/superadmin/subscriptions/${selectedTrial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: "ACTIVE",
          trialEndsAt: null 
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to end trial")
      }

      toast.success(`Trial ended for ${selectedTrial.organization.name}`)
      setIsEndTrialDialogOpen(false)
      setSelectedTrial(null)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to end trial")
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleChangePlan = async () => {
    if (!selectedTrial || !selectedPlanId) return
    
    setIsActionLoading(true)
    try {
      const response = await fetch(`/api/superadmin/subscriptions/${selectedTrial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to change plan")
      }

      const newPlan = plans.find(p => p.id === selectedPlanId)
      toast.success(`Plan changed to ${newPlan?.name} for ${selectedTrial.organization.name}`)
      setIsChangePlanDialogOpen(false)
      setSelectedTrial(null)
      setSelectedPlanId("")
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change plan")
    } finally {
      setIsActionLoading(false)
    }
  }

  const openEndTrialDialog = (trial: TrialSubscription) => {
    setSelectedTrial(trial)
    setIsEndTrialDialogOpen(true)
  }

  const openChangePlanDialog = (trial: TrialSubscription) => {
    setSelectedTrial(trial)
    setSelectedPlanId(trial.planId)
    setIsChangePlanDialogOpen(true)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const getDaysRemaining = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return null
    const now = new Date()
    const endDate = new Date(trialEndsAt)
    const diffTime = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getTrialBadge = (daysRemaining: number | null) => {
    if (daysRemaining === null) return null
    if (daysRemaining <= 0) {
      return <Badge variant="destructive">Expired</Badge>
    }
    if (daysRemaining <= 3) {
      return <Badge variant="destructive">{daysRemaining}d left</Badge>
    }
    if (daysRemaining <= 7) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">{daysRemaining}d left</Badge>
    }
    return <Badge variant="outline">{daysRemaining}d left</Badge>
  }

  // Calculate statistics
  const now = new Date()
  const endOfWeek = new Date(now)
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  const trialsEndingToday = trials.filter(t => {
    if (!t.trialEndsAt) return false
    const endDate = new Date(t.trialEndsAt)
    return endDate <= endOfToday
  }).length

  const trialsEndingThisWeek = trials.filter(t => {
    if (!t.trialEndsAt) return false
    const endDate = new Date(t.trialEndsAt)
    return endDate <= endOfWeek && endDate > endOfToday
  }).length

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(amount))
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Trial Organizations</h1>
        <p className="text-muted-foreground">
          Manage organizations currently in their trial period
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Trials</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trials.length}</div>
            <p className="text-xs text-muted-foreground">Organizations in trial</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ending This Week</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{trialsEndingThisWeek}</div>
            <p className="text-xs text-muted-foreground">Trials ending in 1-7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ending Today</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{trialsEndingToday}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Trials Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Trial Organizations</CardTitle>
          <CardDescription>
            Organizations currently evaluating the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : trials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No organizations in trial</p>
              <p className="text-sm text-muted-foreground">
                When organizations sign up, they&apos;ll appear here during their trial period.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Main Contact</TableHead>
                  <TableHead>Current Plan</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trials.map((trial) => {
                  const daysRemaining = getDaysRemaining(trial.trialEndsAt)
                  return (
                    <TableRow key={trial.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/superadmin/organizations/${trial.organization.slug}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {trial.organization.name}
                          </Link>
                        </div>
                        <p className="text-xs text-muted-foreground">{trial.organization.slug}</p>
                      </TableCell>
                      <TableCell>{formatDate(trial.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {trial.trialEndsAt ? formatDate(trial.trialEndsAt) : "—"}
                          {getTrialBadge(daysRemaining)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {trial.adminContact ? (
                          <div>
                            <p className="font-medium">{trial.adminContact.name || "—"}</p>
                            <a 
                              href={`mailto:${trial.adminContact.email}`}
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              <Mail className="h-3 w-3" />
                              {trial.adminContact.email}
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No admin found</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{trial.plan.name}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(trial.plan.monthlyPrice)}/mo
                        </p>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/superadmin/organizations/${trial.organization.slug}`}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Organization
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openChangePlanDialog(trial)}>
                              <ArrowRightLeft className="mr-2 h-4 w-4" />
                              Change Plan
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => openEndTrialDialog(trial)}
                              className="text-orange-600"
                            >
                              <Play className="mr-2 h-4 w-4" />
                              End Trial Early
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* End Trial Dialog */}
      <Dialog open={isEndTrialDialogOpen} onOpenChange={setIsEndTrialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Trial Early</DialogTitle>
            <DialogDescription>
              This will convert {selectedTrial?.organization.name}&apos;s trial to an active subscription immediately.
              They will start being billed on their next billing cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              <strong>Organization:</strong> {selectedTrial?.organization.name}
            </p>
            <p className="text-sm">
              <strong>Current Plan:</strong> {selectedTrial?.plan.name}
            </p>
            {selectedTrial?.trialEndsAt && (
              <p className="text-sm">
                <strong>Trial was ending:</strong> {formatDate(selectedTrial.trialEndsAt)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEndTrialDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEndTrial} disabled={isActionLoading}>
              {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              End Trial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={isChangePlanDialogOpen} onOpenChange={setIsChangePlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Select a new plan for {selectedTrial?.organization.name}.
              The change will take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Current Plan</Label>
              <p className="text-sm font-medium">{selectedTrial?.plan.name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-plan">New Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger id="new-plan">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangePlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleChangePlan} 
              disabled={isActionLoading || !selectedPlanId || selectedPlanId === selectedTrial?.planId}
            >
              {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
