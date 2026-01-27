"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DownloadIcon, LandmarkIcon, ArrowUpRightIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface Payout {
  id: string
  reference: string
  amount: number
  fees: number
  net: number
  currency: string
  status: "PENDING" | "SCHEDULED" | "PAID" | "FAILED"
  bankAccount: string | null
  scheduledAt: string | null
  paidAt: string | null
  createdAt: string
}

interface PayoutStats {
  pendingAmount: number
  pendingCount: number
  paidYTD: number
  nextPayout: Payout | null
  unsettledAmount: number
  unsettledCount: number
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  SCHEDULED: "secondary",
  PAID: "default",
  FAILED: "destructive",
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = React.useState<Payout[]>([])
  const [loading, setLoading] = React.useState(true)
  const [stats, setStats] = React.useState<PayoutStats>({
    pendingAmount: 0,
    pendingCount: 0,
    paidYTD: 0,
    nextPayout: null,
    unsettledAmount: 0,
    unsettledCount: 0,
  })

  const fetchPayouts = React.useCallback(async () => {
    try {
      const response = await fetch("/api/payouts")
      if (!response.ok) throw new Error("Failed to fetch payouts")

      const data = await response.json()
      setPayouts(data.data)
      setStats(data.stats)
    } catch (error) {
      console.error("Error fetching payouts:", error)
      toast.error("Failed to load payouts")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchPayouts()
  }, [fetchPayouts])

  const handleExport = () => {
    const headers = ["Date", "Batch ID", "Bank Account", "Status", "Gross", "Fees", "Net"]
    const rows = payouts.map((po) => [
      po.paidAt ? format(new Date(po.paidAt), "yyyy-MM-dd") : format(new Date(po.createdAt), "yyyy-MM-dd"),
      po.reference,
      po.bankAccount || "",
      po.status,
      `$${Number(po.amount).toFixed(2)}`,
      `-$${Number(po.fees).toFixed(2)}`,
      `$${Number(po.net).toFixed(2)}`,
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Payouts exported")
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Track settlements transferred to your bank account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Next Estimated Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${Number(stats.unsettledAmount).toFixed(2)}
            </div>
            <p className="text-xs opacity-80 mt-1">
              {stats.nextPayout?.scheduledAt 
                ? `Scheduled for ${format(new Date(stats.nextPayout.scheduledAt), "EEEE, MMM d")}`
                : `From ${stats.unsettledCount} pending transaction${stats.unsettledCount !== 1 ? "s" : ""}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${Number(stats.pendingAmount).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingCount} scheduled payout{stats.pendingCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid (YTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${Number(stats.paidYTD).toFixed(2)}</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRightIcon className="mr-1 h-3 w-3" />
              Year to date
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Settlement History</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={payouts.length === 0}>
              <DownloadIcon className="mr-2 h-4 w-4" />
              Download Report
            </Button>
          </div>
          <CardDescription>
            Detailed breakdown of batches paid out to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payouts yet. Payouts will appear here once settlements are processed.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gross Amount</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="text-right">Net Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell>
                      {po.paidAt 
                        ? format(new Date(po.paidAt), "MMM d, yyyy")
                        : format(new Date(po.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {po.reference}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <LandmarkIcon className="h-3 w-3 text-muted-foreground" />
                        {po.bankAccount ? `****${po.bankAccount}` : "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[po.status] || "outline"}>
                        {po.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">${Number(po.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-red-600">-${Number(po.fees).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">${Number(po.net).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
