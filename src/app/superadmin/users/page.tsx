import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SuperadminUsersTable } from "@/components/superadmin/users-table"

// Force dynamic rendering - this page fetches from database
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  // Fetch users with memberships
  const users = await db.user.findMany({
    include: {
      memberships: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Fetch all organizations for the filter dropdown
  const organizations = await db.organization.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' }
  })

  // Transform data for the client component (serialize dates)
  const serializedUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: user.lastActiveAt?.toISOString() || null,
    memberships: user.memberships.map((m) => ({
      id: m.id,
      role: m.role,
      organization: {
        id: m.organization.id,
        name: m.organization.name,
      }
    }))
  }))

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Manage and view all platform users across organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuperadminUsersTable 
            users={serializedUsers} 
            organizations={organizations}
          />
        </CardContent>
      </Card>
    </div>
  )
}
