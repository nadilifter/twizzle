"use client"

import * as React from "react"
import { 
  Calendar, 
  Play, 
  Search, 
  Loader2,
  Plus,
  Pause,
  XCircle
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

interface RecurringCharge {
  id: string
  description: string
  amount: number
  frequency: "MONTHLY" | "YEARLY" | "SESSION"
  nextChargeDate: string
  lastChargedAt: string | null
  status: "ACTIVE" | "PAUSED" | "CANCELLED" | "FAILED"
  failureCount: number
  user: {
    id: string
    name: string
    email: string
  }
  athlete?: {
    id: string
    name: string
    level: string
  } | null
  paymentMethod?: {
    id: string
    type: string
    last4: string
    brand: string | null
  } | null
}

interface RecurringStats {
  dueTodayAmount: number
  dueTodayCount: number
  activeAmount: number
  activeCount: number
  failedCount: number
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  CANCELLED: "outline",
  FAILED: "destructive",
}

export default function RecurringBillingPage() {
  const [charges, setCharges] = React.useState<RecurringCharge[]>([])
  const [loading, setLoading] = React.useState(true)
  const [running, setRunning] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [searchTerm, setSearchTerm] = React.useState("")
  const [stats, setStats] = React.useState<RecurringStats>({
    dueTodayAmount: 0,
    dueTodayCount: 0,
    activeAmount: 0,
    activeCount: 0,
    failedCount: 0,
  })

  const fetchCharges = React.useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set("search", searchTerm)
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter)

      const response = await fetch(`/api/recurring?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch recurring charges")

      const data = await response.json()
      setCharges(data.data)
      setStats(data.stats)
    } catch (error) {
      console.error("Error fetching recurring charges:", error)
      toast.error("Failed to load recurring charges")
    } finally {
      setLoading(false)
    }
  }, [searchTerm, statusFilter])

  React.useEffect(() => {
    const timeoutId = setTimeout(fetchCharges, 300)
    return () => clearTimeout(timeoutId)
  }, [fetchCharges])

  const handleRunBatch = async () => {
    setRunning(true)
    try {
      const response = await fetch("/api/recurring", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_batch" }),
      })

      if (!response.ok) throw new Error("Failed to run batch")

      const data = await response.json()
      toast.success(`Batch complete: ${data.results.processed} processed, ${data.results.failed} failed, ${data.results.skipped} skipped`)
      fetchCharges()
    } catch (error) {
      console.error("Error running batch:", error)
      toast.error("Failed to run batch")
    } finally {
      setRunning(false)
    }
  }

  const handleStatusChange = async (id: string, newStatus: "ACTIVE" | "PAUSED" | "CANCELLED") => {
    try {
      const response = await fetch("/api/recurring", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      })

      if (!response.ok) throw new Error("Failed to update status")

      toast.success(`Charge ${newStatus.toLowerCase()}`)
      fetchCharges()
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Billing</h1>
          <p className="text-muted-foreground">
            Manage automated tuition collection and payment schedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={running || stats.dueTodayCount === 0}>
                {running ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run Batch Now
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run Billing Batch</AlertDialogTitle>
                <AlertDialogDescription>
                  This will process {stats.dueTodayCount} recurring charge{stats.dueTodayCount !== 1 ? "s" : ""} totaling ${Number(stats.dueTodayAmount).toFixed(2)}. 
                  Are you sure you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRunBatch}>Run Batch</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Number(stats.dueTodayAmount).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Due today ({stats.dueTodayCount} charge{stats.dueTodayCount !== 1 ? "s" : ""})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Recurring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
            <p className="text-xs text-muted-foreground">
              ${Number(stats.activeAmount).toFixed(2)}/month total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed/Retry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.failedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PAUSED">Paused</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guardian / Athlete</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Next Charge</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading recurring charges...
                  </div>
                </TableCell>
              </TableRow>
            ) : charges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No recurring charges found. Set up automated billing for your members.
                </TableCell>
              </TableRow>
            ) : (
              charges.map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{charge.user.name}</span>
                      {charge.athlete && (
                        <span className="text-xs text-muted-foreground">{charge.athlete.name}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{charge.description}</span>
                      <span className="text-xs text-muted-foreground capitalize">{charge.frequency.toLowerCase()}</span>
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(charge.nextChargeDate), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {charge.paymentMethod ? (
                      `${charge.paymentMethod.brand || charge.paymentMethod.type} ****${charge.paymentMethod.last4}`
                    ) : (
                      <span className="text-yellow-600">No payment method</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[charge.status] || "outline"}>
                      {charge.status}
                    </Badge>
                    {charge.failureCount > 0 && charge.status === "FAILED" && (
                      <span className="ml-1 text-xs text-destructive">({charge.failureCount})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">${Number(charge.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {charge.status === "ACTIVE" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(charge.id, "PAUSED")}>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </DropdownMenuItem>
                        )}
                        {charge.status === "PAUSED" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(charge.id, "ACTIVE")}>
                            <Play className="mr-2 h-4 w-4" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        {charge.status === "FAILED" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(charge.id, "ACTIVE")}>
                            <Play className="mr-2 h-4 w-4" />
                            Retry
                          </DropdownMenuItem>
                        )}
                        {charge.status !== "CANCELLED" && (
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleStatusChange(charge.id, "CANCELLED")}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
