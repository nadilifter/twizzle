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
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Stashed Functionality</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hidden Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-medium">Microsoft & Facebook Login</span> (login/signup forms) - 
                <span className="text-muted-foreground ml-2">OAuth buttons hidden until integration is implemented. Only Google OAuth is active.</span>
              </li>
              <li>
                <span className="font-medium">App Page</span> (/dashboard/organization/app) - 
                <span className="text-muted-foreground ml-2">Hidden from My Organization section.</span>
              </li>
              <li>
                <span className="font-medium">Analytics Page</span> (/dashboard/analytics) - 
                <span className="text-muted-foreground ml-2">Hidden from Dashboard section.</span>
              </li>
              <li>
                <span className="font-medium">Training Section</span> (/dashboard/training) - 
                <span className="text-muted-foreground ml-2">Hidden from sidebar. Includes Plans, Programs, Rotations, and Skills.</span>
              </li>
              <li>
                <span className="font-medium">Events Section</span> (/dashboard/events) - 
                <span className="text-muted-foreground ml-2">Hidden from sidebar and access points. Includes Calendar, Upcoming events, and Events Portal.</span>
              </li>
              <li>
                <span className="font-medium">Communication Section</span> (/dashboard/communication) - 
                <span className="text-muted-foreground ml-2">Hidden from sidebar. Includes Announcements, Chat, Email, Notifications, and SMS.</span>
              </li>
              <li>
                <span className="font-medium">Forms Section</span> (/dashboard/forms) - 
                <span className="text-muted-foreground ml-2">Hidden from sidebar. Includes Surveys and Waivers.</span>
              </li>
              <li>
                <span className="font-medium">Campaigns Section</span> (/campaigns) - 
                <span className="text-muted-foreground ml-2">Hidden from sidebar until ready for release. Includes Advertising, Donation, Merchandise, and Sponsorship.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
