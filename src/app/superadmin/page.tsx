import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"

// Force dynamic rendering - this page fetches from database
export const dynamic = 'force-dynamic';

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
            <CardTitle className="text-base">Hidden from sidebar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Live feature indicators are hidden in the dashboard sidebar; only beta/demo features show an indicator (flask icon).
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Now visible:</span> QBO &amp; Xero Integrations (/dashboard/financials/integrations) is shown in the Financials section of the admin sidebar.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-medium">Dashboard Overview</span> (/dashboard) - 
                <span className="text-muted-foreground ml-2">Sidebar shows &quot;Dashboard&quot; link only; Overview label removed.</span>
              </li>
              <li>
                <span className="font-medium">Training Overview, Plans, Rotations</span> (/dashboard/training, /dashboard/training/plans, /dashboard/training/rotations) - 
                <span className="text-muted-foreground ml-2">Hidden from Training section. Only Skills and Evaluations shown.</span>
              </li>
              <li>
                <span className="font-medium">Microsoft & Facebook Login</span> (login/signup forms) - 
                <span className="text-muted-foreground ml-2">OAuth buttons hidden until integration is implemented. Only Google OAuth is active.</span>
              </li>
              <li>
                <span className="font-medium">Analytics Page</span> (/dashboard/analytics) - 
                <span className="text-muted-foreground ml-2">Hidden from Dashboard section.</span>
              </li>
              <li>
                <span className="font-medium">Forms Section</span> (/dashboard/forms) - 
                <span className="text-muted-foreground ml-2">Forms parent page. Waivers moved to Athletes section (/dashboard/athletes/waivers).</span>
              </li>
              <li>
                <span className="font-medium">Surveys</span> (/dashboard/forms/surveys) - 
                <span className="text-muted-foreground ml-2">Hidden from Forms section in admin sidebar.</span>
              </li>
              <li>
                <span className="font-medium">Campaigns Section</span> (/campaigns) - 
                <span className="text-muted-foreground ml-2">Hidden from sidebar until ready for release. Includes Advertising, Donation, Merchandise, and Sponsorship.</span>
              </li>
              <li>
                <span className="font-medium">Chat</span> (/dashboard/communication/chat) - 
                <span className="text-muted-foreground ml-2">Hidden from Communication section in admin sidebar.</span>
              </li>
              <li>
                <span className="font-medium">App</span> (/dashboard/organization/app) - 
                <span className="text-muted-foreground ml-2">Hidden from My Organization section in admin sidebar.</span>
              </li>
              <li>
                <span className="font-medium">Events</span> (/dashboard/events) - 
                <span className="text-muted-foreground ml-2">Now visible under Registrations section. Gated by the Events feature toggle.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
