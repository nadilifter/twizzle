import { db } from "@/lib/db"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    include: {
      memberships: {
        include: {
            organization: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role (Platform)</TableHead>
                <TableHead>Organizations</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                      {user.isSuperAdmin ? <Badge variant="destructive">Super Admin</Badge> : user.role}
                  </TableCell>
                  <TableCell>
                      <div className="flex flex-col gap-1">
                          {user.memberships.map(m => (
                              <span key={m.id} className="text-xs text-muted-foreground">
                                  {m.organization.name} ({m.role})
                              </span>
                          ))}
                      </div>
                  </TableCell>
                  <TableCell>
                      <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
                          {user.status}
                      </Badge>
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
