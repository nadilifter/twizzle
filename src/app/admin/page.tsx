import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"

export default async function AdminDashboardPage() {
  const orgCount = await db.organization.count()
  const userCount = await db.user.count()
  const activeMemberships = await db.organizationMember.count({
      where: { status: "ACTIVE" }
  })

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Memberships</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMemberships}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
