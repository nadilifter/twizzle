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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LayoutDashboard } from "lucide-react"

function getAdminDashboardSwitchUrl(orgId: string, orgName: string): string {
  const isLocal = process.env.NODE_ENV === 'development'
  const adminBase = isLocal
    ? 'http://admin.uplifterinc.localhost:3000'
    : 'https://admin.uplifterinc.com'
  return `${adminBase}/dashboard/switch-org?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}`
}

export default async function AdminOrganizationsPage() {
  const organizations = await db.organization.findMany({
    include: {
      _count: {
        select: { members: true, invoices: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Organizations</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug (Domain)</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Invoices</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <Link 
                      href={`/superadmin/organizations/${org.id}`}
                      className="text-primary hover:underline"
                    >
                      {org.name}
                    </Link>
                  </TableCell>
                  <TableCell>{org.slug}</TableCell>
                  <TableCell>
                    <Link 
                      href={`/superadmin/organizations/${org.id}/members`}
                      className="text-primary hover:underline"
                    >
                      {org._count.members}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link 
                      href={`/superadmin/organizations/${org.id}/invoices`}
                      className="text-primary hover:underline"
                    >
                      {org._count.invoices}
                    </Link>
                  </TableCell>
                  <TableCell>{org.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm" title="Open Admin Dashboard">
                      <a href={getAdminDashboardSwitchUrl(org.id, org.name)}>
                        <LayoutDashboard className="h-4 w-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
