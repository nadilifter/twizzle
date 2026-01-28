import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { EventsSidebar } from "@/components/events-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  
  if (!session) {
    redirect("/login?callbackUrl=/events")
  }

  return (
    <SidebarProvider>
      <EventsSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
