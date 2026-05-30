import { db } from "@/lib/db";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard } from "lucide-react";
import { getSubdomainUrl } from "@/lib/env-domains";

function getAdminDashboardSwitchUrl(orgId: string, orgName: string): string {
  const adminBase = getSubdomainUrl("admin");
  return `${adminBase}/dashboard/switch-org?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}`;
}

import { StatusFilter } from "./status-filter";

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminOrganizationsPage({ searchParams }: Props) {
  const { status: statusFilter } = await searchParams;

  const statusWhere =
    statusFilter === "active"
      ? { isActive: true }
      : statusFilter === "deactivated"
        ? { isActive: false }
        : undefined;

  const organizations = await db.organization.findMany({
    where: {
      ...statusWhere,
    },
    include: {
      _count: {
        select: { members: true, invoices: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <div className="flex items-center gap-2">
          <StatusFilter currentStatus={statusFilter} />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Slug (Domain)</TableHead>
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
                    No organizations yet.
                  </TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => (
                  <TableRow key={org.id} className={org.isActive ? "" : "opacity-60"}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/superadmin/organizations/${org.slug}`}
                        className="text-primary hover:underline"
                      >
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.isActive ? "default" : "destructive"} className="text-xs">
                        {org.isActive ? "Active" : "Deactivated"}
                      </Badge>
                    </TableCell>
                    <TableCell>{org.slug}</TableCell>
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
  );
}
