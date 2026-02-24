import { db } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const organization = await db.organization.findUnique({
    where: { slug },
    select: { name: true }
  })
  
  return {
    title: organization ? `${organization.name} - Invoices | Superadmin` : 'Invoices | Superadmin'
  }
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function OrganizationInvoicesPage({ params }: Props) {
  const { slug } = await params
  
  const organization = await db.organization.findUnique({
    where: { slug },
    include: {
      invoices: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: {
            select: { lineItems: true, payments: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!organization) {
    notFound()
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

  const formatCurrency = (amount: unknown) => {
    const num = typeof amount === 'object' && amount !== null 
      ? Number(amount.toString()) 
      : Number(amount)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num)
  }

  // Calculate totals
  const totalInvoices = organization.invoices.length
  const paidInvoices = organization.invoices.filter(i => i.status === 'PAID').length
  const overdueInvoices = organization.invoices.filter(i => i.status === 'OVERDUE').length
  const totalRevenue = organization.invoices
    .filter(i => i.status === 'PAID')
    .reduce((sum, i) => sum + Number(i.total), 0)

  return (
    <div className="flex flex-col gap-6 p-4">
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/superadmin">Admin</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/superadmin/organizations">Organizations</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/superadmin/organizations/${slug}`}>{organization.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Invoices</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">
          All invoices for {organization.name}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices ({totalInvoices})</CardTitle>
          <CardDescription>
            Invoice history for this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organization.invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No invoices found for this organization
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Billed To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organization.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.reference}</TableCell>
                    <TableCell>{invoice.user?.name ?? 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invoice.status) as "default" | "destructive" | "secondary" | "outline"}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{invoice.dueDate.toLocaleDateString()}</TableCell>
                    <TableCell>{invoice._count.lineItems}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total)}
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
