import { SuperadminSidebar } from "@/components/superadmin-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  
  if (!session?.user?.isSuperAdmin) {
    redirect("/dashboard")
  }

  return (
    <SidebarProvider>
      <SuperadminSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
