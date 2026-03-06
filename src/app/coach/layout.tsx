import { CoachSidebar } from "@/components/coach-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { UserImpersonationBanner } from "@/components/user-impersonation-banner"
import { getAuthSession } from "@/lib/auth"
import { getCoachingMemberships } from "@/lib/impersonation"
import { redirect } from "next/navigation"

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  
  if (!session) {
    redirect("/login?callbackUrl=/coach")
  }

  if (!session.user.isSuperAdmin) {
    const coachingMemberships = await getCoachingMemberships(session)
    if (coachingMemberships.length === 0) {
      redirect("/dashboard")
    }
  }

  return (
    <>
      <UserImpersonationBanner exitUrl="/coach/admin/view-as-user" />
      <SidebarProvider>
        <CoachSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
