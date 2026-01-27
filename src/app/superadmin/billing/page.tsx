import { db } from "@/lib/db"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DollarSign, FileText, TrendingUp, AlertCircle } from "lucide-react"

export default async function SuperadminBillingPage() {
  // Get all invoices across the platform
  const invoices = await db.invoice.findMany({
    include: {
      organization: true,
      family: true,
      _count: {
        select: { lineItems: true, payments: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  // Get all payments across the platform
  const payments = await db.payment.findMany({
    include: {
      family: true,
      invoice: {
        include: {
          organization: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  })

  // Calculate platform-wide statistics
  const totalInvoices = await db.invoice.count()
  const paidInvoices = await db.invoice.count({ where: { status: 'PAID' }})
  const overdueInvoices = await db.invoice.count({ where: { status: 'OVERDUE' }})
  const pendingInvoices = await db.invoice.count({ where: { status: { in: ['DRAFT', 'SENT'] }}})

  // Revenue calculations
  const allPaidInvoices = await db.invoice.findMany({
    where: { status: 'PAID' },
    select: { total: true }
  })
  const totalRevenue = allPaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)

  const allOutstandingInvoices = await db.invoice.findMany({
    where: { status: { in: ['SENT', 'OVERDUE', 'PARTIAL'] }},
    select: { total: true }
  })
  const outstandingAmount = allOutstandingInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)

  // Revenue by organization
  const revenueByOrg = await db.invoice.groupBy({
    by: ['organizationId'],
    where: { status: 'PAID' },
    _sum: { total: true },
    _count: true
  })

  // Get organization names for the grouped data
  const orgIds = revenueByOrg.map(r => r.organizationId)
  const organizations = await db.organization.findMany({
    where: { id: { in: orgIds }},
    select: { id: true, name: true }
  })

  const orgMap = new Map(organizations.map(o => [o.id, o.name]))

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'default'
      case 'OVERDUE':
        return 'destructive'
      case 'SENT':
        return 'outline'
      case 'PARTIAL':
        return 'secondary'
      case 'CANCELLED':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getPaymentStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'default'
      case 'PENDING':
        return 'outline'
      case 'FAILED':
        return 'destructive'
      case 'REFUNDED':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Platform Billing</h1>
        <p className="text-muted-foreground">
          Overview of all billing activity across the platform
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From {paidInvoices} paid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(outstandingAmount)}</div>
            <p className="text-xs text-muted-foreground">{pendingInvoices} pending invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueInvoices}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">All-time invoices</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue by Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Organization</CardTitle>
            <CardDescription>Breakdown of paid invoices by organization</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByOrg.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No revenue data yet</p>
            ) : (
              <div className="space-y-4">
                {revenueByOrg
                  .sort((a, b) => Number(b._sum.total) - Number(a._sum.total))
                  .slice(0, 10)
                  .map((item) => (
                    <div key={item.organizationId} className="flex items-center justify-between">
                      <div>
                        <Link 
                          href={`/superadmin/organizations/${item.organizationId}`}
                          className="font-medium hover:underline"
                        >
                          {orgMap.get(item.organizationId) || 'Unknown'}
                        </Link>
                        <p className="text-xs text-muted-foreground">{item._count} invoices</p>
                      </div>
                      <span className="font-bold text-green-600">
                        {formatCurrency(Number(item._sum.total))}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Latest payment activity</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No payments yet</p>
            ) : (
              <div className="space-y-4">
                {payments.slice(0, 10).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{payment.family.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.invoice?.organization.name || 'N/A'} • {payment.method}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(Number(payment.amount))}</span>
                      <Badge variant={getPaymentStatusBadgeVariant(payment.status) as "default" | "destructive" | "secondary" | "outline"}>
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>
            Latest invoices across all organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No invoices found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.reference}</TableCell>
                    <TableCell>
                      <Link 
                        href={`/superadmin/organizations/${invoice.organizationId}`}
                        className="text-primary hover:underline"
                      >
                        {invoice.organization.name}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.family.name}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invoice.status) as "default" | "destructive" | "secondary" | "outline"}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{invoice.dueDate.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(invoice.total))}
                    </TableCell>
                    <TableCell>{invoice.createdAt.toLocaleDateString()}</TableCell>
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
