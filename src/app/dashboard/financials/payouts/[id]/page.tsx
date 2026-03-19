"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
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
import {
  ArrowLeftIcon,
  LandmarkIcon,
  Loader2,
  CalendarIcon,
  ClockIcon,
  DollarSignIcon,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface Transaction {
  id: string
  pspReference: string
  type: string
  amount: number
  currency: string
  status: string
  method: string | null
  description: string | null
  settledAt: string | null
  createdAt: string
}

interface PayoutDetail {
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
  estimatedArrivalTime: string | null
  createdAt: string
  transactions: Transaction[]
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  SCHEDULED: "secondary",
  PAID: "default",
  FAILED: "destructive",
}

const txTypeColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PAYMENT: "default",
  REFUND: "destructive",
  CHARGEBACK: "destructive",
  CAPTURE: "secondary",
  CANCEL: "outline",
}

export default function PayoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [payout, setPayout] = React.useState<PayoutDetail | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchPayout() {
      try {
        const response = await fetch(`/api/payouts/${params.id}`)
        if (!response.ok) {
          if (response.status === 404) {
            toast.error("Payout not found")
            router.push("/dashboard/financials/payouts")
            return
          }
          throw new Error("Failed to fetch payout")
        }
        const data = await response.json()
        setPayout(data)
      } catch (error) {
        console.error("Error fetching payout:", error)
        toast.error("Failed to load payout details")
      } finally {
        setLoading(false)
      }
    }
    if (params.id) fetchPayout()
  }, [params.id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!payout) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Payout not found.</p>
      </div>
    )
  }

  const primaryDate = payout.paidAt || payout.scheduledAt || payout.createdAt

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/financials/payouts")}
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Payouts
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Payout Details</h1>
          <Badge variant={statusColors[payout.status] || "outline"} className="text-sm">
            {payout.status}
          </Badge>
        </div>
        <p className="text-sm font-mono text-muted-foreground">{payout.reference}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
              Gross Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Number(payout.amount).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -${Number(payout.fees).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${Number(payout.net).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LandmarkIcon className="h-4 w-4 text-muted-foreground" />
              Bank Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payout.bankAccount ? `****${payout.bankAccount}` : "\u2014"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{format(new Date(payout.createdAt), "MMM d, yyyy h:mm a")}</p>
              </div>
            </div>
            {payout.scheduledAt && (
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Scheduled</p>
                  <p className="font-medium">{format(new Date(payout.scheduledAt), "MMM d, yyyy h:mm a")}</p>
                </div>
              </div>
            )}
            {payout.estimatedArrivalTime && (
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Est. Arrival</p>
                  <p className="font-medium">{format(new Date(payout.estimatedArrivalTime), "MMM d, yyyy h:mm a")}</p>
                </div>
              </div>
            )}
            {payout.paidAt && (
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-muted-foreground">Paid</p>
                  <p className="font-medium text-green-600">{format(new Date(payout.paidAt), "MMM d, yyyy h:mm a")}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Included Transactions</CardTitle>
          <CardDescription>
            {payout.transactions.length > 0
              ? `${payout.transactions.length} transaction${payout.transactions.length !== 1 ? "s" : ""} included in this payout.`
              : "No transactions linked to this payout yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payout.transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Transactions are linked to payouts when the payout is marked as paid.
              {payout.status !== "PAID" && " This payout has not been paid yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>PSP Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payout.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      {tx.settledAt
                        ? format(new Date(tx.settledAt), "MMM d, yyyy")
                        : format(new Date(tx.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tx.pspReference}
                    </TableCell>
                    <TableCell>
                      <Badge variant={txTypeColors[tx.type] || "outline"} className="text-xs">
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {tx.method || "\u2014"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {tx.description || "\u2014"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {tx.type === "REFUND" || tx.type === "CHARGEBACK" ? "-" : ""}
                      ${Math.abs(Number(tx.amount)).toFixed(2)}
                    </TableCell>
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
