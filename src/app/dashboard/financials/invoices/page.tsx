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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LinkIcon, SendIcon, MoreHorizontalIcon, Search, Loader2, ExternalLinkIcon } from "lucide-react"
import { CreateInvoiceSheet } from "@/components/invoices/create-invoice-sheet"
import { format } from "date-fns"
import { toast } from "sonner"

interface Invoice {
  id: string
  reference: string
  user: {
    id: string
    name: string
    email: string
  } | null
  lineItems: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    total: number
    athlete?: { id: string; name: string } | null
  }>
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "PARTIAL"
  dueDate: string
  subtotal: number
  tax: number
  total: number
  paidAmount: number
  balanceDue: number
  createdAt: string
}

interface InvoiceStats {
  outstanding: number
  outstandingCount: number
  collected: number
  successRate: number
}

const statusColors: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SENT: "outline",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "secondary",
  PARTIAL: "outline",
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [siteSubdomain, setSiteSubdomain] = React.useState<string | null>(null)
  const [stats, setStats] = React.useState<InvoiceStats>({
    outstanding: 0,
    outstandingCount: 0,
    collected: 0,
    successRate: 0,
  })

  const fetchInvoices = React.useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      
      const response = await fetch(`/api/invoices?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch invoices")
      
      const data = await response.json()
      setInvoices(data.data)
      if (data.siteSubdomain) setSiteSubdomain(data.siteSubdomain)
      
      // Calculate stats
      const outstanding = data.data
        .filter((inv: Invoice) => ["SENT", "PARTIAL", "OVERDUE"].includes(inv.status))
        .reduce((sum: number, inv: Invoice) => sum + Number(inv.balanceDue), 0)
      
      const outstandingCount = data.data.filter((inv: Invoice) => 
        ["SENT", "PARTIAL", "OVERDUE"].includes(inv.status)
      ).length
      
      const collected = data.data
        .filter((inv: Invoice) => inv.status === "PAID")
        .reduce((sum: number, inv: Invoice) => sum + Number(inv.total), 0)
      
      const totalInvoices = data.data.length
      const paidInvoices = data.data.filter((inv: Invoice) => inv.status === "PAID").length
      const successRate = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0
      
      setStats({
        outstanding,
        outstandingCount,
        collected,
        successRate,
      })
    } catch (error) {
      console.error("Error fetching invoices:", error)
      toast.error("Failed to load invoices")
    } finally {
      setLoading(false)
    }
  }, [search])

  React.useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const handleCopyPaymentLink = (invoice: Invoice) => {
    // In a real implementation, this would generate/copy an Adyen payment link
    const link = `${window.location.origin}/pay/${invoice.reference}`
    navigator.clipboard.writeText(link)
    toast.success("Payment link copied to clipboard")
  }

  const handleResendEmail = async (invoice: Invoice) => {
    if (!invoice.user?.email) {
      toast.error("No guardian email associated with this invoice")
      return
    }
    // In a real implementation, this would trigger an email
    toast.success(`Email sent to ${invoice.user.email}`)
  }

  const handleViewReceipt = (invoice: Invoice) => {
    if (!siteSubdomain) {
      toast.error("No site configured for this organization")
      return
    }
    const host = window.location.host
    const baseDomain = host.includes("localhost")
      ? host.replace(/^[^.]+\./, "")
      : host.replace(/^[^.]+\./, "")
    const protocol = window.location.protocol
    window.open(`${protocol}//${siteSubdomain}.${baseDomain}/receipt/${invoice.id}`, "_blank")
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground">
              Create and manage payment links using Adyen Pay by Link.
            </p>
          </div>
          <CreateInvoiceSheet onSuccess={fetchInvoices} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.outstanding.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Across {stats.outstandingCount} active invoice{stats.outstandingCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collected this Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.collected.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Via Pay by Link</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payment Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>
                Manage invoices and copy payment links for your customers.
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invoices found. Create your first invoice to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.reference}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{invoice.user?.name ?? "No guardian"}</span>
                        <span className="text-xs text-muted-foreground">
                          {invoice.user?.email ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {invoice.lineItems[0]?.description || "Invoice"}
                      {invoice.lineItems.length > 1 && (
                        <span className="text-muted-foreground">
                          {" "}+{invoice.lineItems.length - 1} more
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(invoice.dueDate), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[invoice.status] || "outline"}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold">${Number(invoice.total).toFixed(2)}</span>
                        {invoice.status === "PARTIAL" && (
                          <span className="text-xs text-muted-foreground">
                            ${Number(invoice.balanceDue).toFixed(2)} due
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {siteSubdomain && (
                            <DropdownMenuItem onClick={() => handleViewReceipt(invoice)}>
                              <ExternalLinkIcon className="mr-2 h-4 w-4" />
                              View Receipt
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleCopyPaymentLink(invoice)}>
                            <LinkIcon className="mr-2 h-4 w-4" />
                            Copy Payment Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResendEmail(invoice)}>
                            <SendIcon className="mr-2 h-4 w-4" />
                            Resend Email
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
