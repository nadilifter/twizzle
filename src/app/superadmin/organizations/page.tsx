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
import { Badge } from "@/components/ui/badge"
import { LayoutDashboard } from "lucide-react"
import { getSubdomainUrl } from "@/lib/env-domains"
import { SportFilter } from "./sport-filter"

function getAdminDashboardSwitchUrl(orgId: string, orgName: string): string {
  const adminBase = getSubdomainUrl('admin')
  return `${adminBase}/dashboard/switch-org?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}`
}

interface Props {
  searchParams: Promise<{ sport?: string }>
}

export default async function AdminOrganizationsPage({ searchParams }: Props) {
  const { sport: sportFilter } = await searchParams

  const [organizations, allSports] = await Promise.all([
    db.organization.findMany({
      where: sportFilter
        ? { sports: { some: { sport: { slug: sportFilter } } } }
        : undefined,
      include: {
        _count: {
          select: { members: true, invoices: true },
        },
        sports: {
          include: {
            sport: {
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { sport: { displayOrder: "asc" } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.sport.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <SportFilter sports={allSports} currentSport={sportFilter} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {sportFilter
              ? `Organizations — ${allSports.find((s) => s.slug === sportFilter)?.name || sportFilter}`
              : "All Organizations"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug (Domain)</TableHead>
                <TableHead>Sports</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Invoices</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {sportFilter
                      ? "No organizations found for this sport."
                      : "No organizations yet."}
                  </TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/superadmin/organizations/${org.slug}`}
                        className="text-primary hover:underline"
                      >
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell>{org.slug}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {org.sports.length === 0 ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : org.sports.length <= 3 ? (
                          org.sports.map((os) => (
                            <Badge key={os.sport.id} variant="secondary" className="text-xs">
                              {os.sport.name}
                            </Badge>
                          ))
                        ) : (
                          <>
                            {org.sports.slice(0, 2).map((os) => (
                              <Badge key={os.sport.id} variant="secondary" className="text-xs">
                                {os.sport.name}
                              </Badge>
                            ))}
                            <Badge variant="outline" className="text-xs">
                              +{org.sports.length - 2} more
                            </Badge>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/superadmin/organizations/${org.slug}/members`}
                        className="text-primary hover:underline"
                      >
                        {org._count.members}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/superadmin/organizations/${org.slug}/invoices`}
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
