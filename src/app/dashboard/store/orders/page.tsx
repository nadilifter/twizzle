"use client"

import * as React from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search,
  Loader2,
  MoreHorizontal,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronRight,
  Banknote,
  CreditCard,
  Landmark,
  FileText,
  Wallet,
  BadgeDollarSign,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface OrderLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  productId: string | null
  productVariantId: string | null
  productVariant: { id: string; label: string } | null
}

interface Order {
  id: string
  source: "POS" | "ONLINE"
  fulfillmentStatus: "PENDING" | "FULFILLED" | "CANCELLED"
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  fulfilledAt: string | null
  notes: string | null
  createdAt: string
  invoice: {
    id: string
    reference: string
    subtotal: number
    tax: number
    total: number
    status: string
    lineItems: OrderLineItem[]
    payments: { method: string; status: string; transaction: { method: string | null } | null }[]
  }
}

const paymentMethodConfig: Record<string, { label: string; icon: React.ElementType; variant: "default" | "outline" | "secondary" }> = {
  CASH: { label: "Cash", icon: Banknote, variant: "secondary" },
  CARD: { label: "Card", icon: CreditCard, variant: "outline" },
  BANK: { label: "Bank", icon: Landmark, variant: "outline" },
  CHECK: { label: "Check", icon: FileText, variant: "outline" },
}

const transactionMethodLabels: Record<string, { label: string; icon: React.ElementType }> = {
  applepay: { label: "Apple Pay", icon: Wallet },
  googlepay: { label: "Google Pay", icon: Wallet },
  paypal: { label: "PayPal", icon: Wallet },
  cashapp: { label: "Cash App Pay", icon: Wallet },
  klarna: { label: "Klarna", icon: BadgeDollarSign },
  klarna_account: { label: "Klarna", icon: BadgeDollarSign },
  klarna_paynow: { label: "Klarna", icon: BadgeDollarSign },
  affirm: { label: "Affirm", icon: BadgeDollarSign },
  afterpay_default: { label: "Afterpay", icon: BadgeDollarSign },
  afterpaytouch: { label: "Afterpay", icon: BadgeDollarSign },
  clearpay: { label: "Clearpay", icon: BadgeDollarSign },
  amazonpay: { label: "Amazon Pay", icon: Wallet },
  ach: { label: "ACH", icon: Landmark },
  paybybank_us: { label: "Pay by Bank", icon: Landmark },
  venmo: { label: "Venmo", icon: Wallet },
}

function getPaymentLabel(payment: { method: string; transaction: { method: string | null } | null }): { label: string; icon: React.ElementType; variant: "default" | "outline" | "secondary" } {
  const txMethod = payment.transaction?.method?.toLowerCase()
  if (txMethod) {
    const txConfig = transactionMethodLabels[txMethod]
    if (txConfig) {
      return { ...txConfig, variant: "outline" }
    }
  }
  const config = paymentMethodConfig[payment.method]
  if (config) {
    if (txMethod && payment.method === "CARD") {
      const network = txMethod.charAt(0).toUpperCase() + txMethod.slice(1)
      return { ...config, label: network }
    }
    return config
  }
  return { label: payment.method, icon: CreditCard, variant: "outline" }
}

const fulfillmentColors: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  PENDING: "outline",
  FULFILLED: "default",
  CANCELLED: "secondary",
}

const fulfillmentIcons: Record<string, React.ElementType> = {
  PENDING: Clock,
  FULFILLED: CheckCircle2,
  CANCELLED: XCircle,
}

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<Order[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [sourceFilter, setSourceFilter] = React.useState("all")
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())

  const fetchOrders = React.useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (sourceFilter !== "all") params.set("source", sourceFilter)

      const response = await fetch(`/api/orders?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch orders")
      const data = await response.json()
      setOrders(data.data || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast.error("Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, sourceFilter])

  React.useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleUpdateStatus = async (orderId: string, fulfillmentStatus: "FULFILLED" | "CANCELLED" | "PENDING") => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillmentStatus }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update order")
      }

      toast.success(
        fulfillmentStatus === "FULFILLED"
          ? "Order marked as fulfilled"
          : fulfillmentStatus === "CANCELLED"
            ? "Order cancelled"
            : "Order reopened"
      )
      fetchOrders()
    } catch (error) {
      console.error("Error updating order:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update order")
    }
  }

  const toggleRow = (orderId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const getItemsSummary = (lineItems: OrderLineItem[]) => {
    const totalQty = lineItems.reduce((sum, li) => sum + li.quantity, 0)
    const uniqueProducts = lineItems.length
    if (uniqueProducts === 0) return "No items"
    if (uniqueProducts === 1) return `${lineItems[0].description} (x${totalQty})`
    return `${uniqueProducts} products, ${totalQty} items`
  }

  const pendingCount = orders.filter((o) => o.fulfillmentStatus === "PENDING").length

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
        <p className="text-sm text-muted-foreground">
          Track and manage product orders from your store and point of sale.
          {pendingCount > 0 && (
            <span className="ml-1 font-medium text-foreground">
              {pendingCount} order{pendingCount !== 1 ? "s" : ""} pending fulfillment.
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FULFILLED">Fulfilled</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="POS">POS</SelectItem>
            <SelectItem value="ONLINE">Online</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No orders yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const isExpanded = expandedRows.has(order.id)
                const StatusIcon = fulfillmentIcons[order.fulfillmentStatus]
                return (
                  <React.Fragment key={order.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleRow(order.id)}>
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {order.invoice.reference}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {order.customerName || "Walk-in"}
                          </span>
                          {order.customerEmail && (
                            <span className="text-xs text-muted-foreground">
                              {order.customerEmail}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.source === "POS" ? "secondary" : "outline"}>
                          {order.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {getItemsSummary(order.invoice.lineItems)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(order.invoice.total).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const payment = order.invoice.payments?.[0]
                          if (!payment) return <span className="text-xs text-muted-foreground">—</span>
                          const { label, icon: PaymentIcon, variant } = getPaymentLabel(payment)
                          return (
                            <Badge variant={variant}>
                              <PaymentIcon className="h-3 w-3 mr-1" />
                              {label}
                            </Badge>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={fulfillmentColors[order.fulfillmentStatus]}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {order.fulfillmentStatus === "PENDING"
                            ? "Pending"
                            : order.fulfillmentStatus === "FULFILLED"
                              ? "Fulfilled"
                              : "Cancelled"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {order.fulfillmentStatus === "PENDING" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(order.id, "FULFILLED")}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Mark Fulfilled
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleUpdateStatus(order.id, "CANCELLED")}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Order
                                </DropdownMenuItem>
                              </>
                            )}
                            {order.fulfillmentStatus === "FULFILLED" && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateStatus(order.id, "PENDING")}
                              >
                                <Clock className="mr-2 h-4 w-4" />
                                Reopen Order
                              </DropdownMenuItem>
                            )}
                            {order.fulfillmentStatus === "CANCELLED" && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateStatus(order.id, "PENDING")}
                              >
                                <Clock className="mr-2 h-4 w-4" />
                                Reopen Order
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={10} className="p-0">
                          <div className="px-8 py-4">
                            <h4 className="text-sm font-medium mb-2">Order Items</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Unit Price</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {order.invoice.lineItems.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="text-sm">
                                      {item.description}
                                      {item.productVariant && (
                                        <span className="text-xs text-muted-foreground ml-1">({item.productVariant.label})</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                                    <TableCell className="text-right text-sm">
                                      ${Number(item.unitPrice).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-medium">
                                      ${Number(item.total).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="mt-3 flex justify-between items-center text-sm">
                              <div className="text-muted-foreground">
                                {order.fulfilledAt && (
                                  <span>
                                    Fulfilled on {format(new Date(order.fulfilledAt), "MMM d, yyyy h:mm a")}
                                  </span>
                                )}
                              </div>
                              <div className="text-right space-y-0.5">
                                <div className="text-muted-foreground">
                                  Subtotal: ${Number(order.invoice.subtotal).toFixed(2)}
                                </div>
                                {Number(order.invoice.tax) > 0 && (
                                  <div className="text-muted-foreground">
                                    Tax: ${Number(order.invoice.tax).toFixed(2)}
                                  </div>
                                )}
                                <div className="font-medium">
                                  Total: ${Number(order.invoice.total).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {total > orders.length && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {orders.length} of {total} orders
        </p>
      )}
    </div>
  )
}
