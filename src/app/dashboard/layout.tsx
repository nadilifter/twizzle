import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { FeatureProvider } from "@/components/feature-context"
import { BreadcrumbOverrideProvider } from "@/components/breadcrumb-context"
import { getAuthSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { getSubdomainUrl } from "@/lib/env-domains"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()

  if (session?.user?.organizationId && !session.user.isSuperAdmin) {
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { isActive: true, name: true, deactivationReason: true },
    })

    if (org && !org.isActive) {
      const params = new URLSearchParams({
        reason: org.deactivationReason || "Unknown",
        org: org.name,
      })
      const loginBase = getSubdomainUrl("login")
      redirect(`${loginBase}/organization-deactivated?${params.toString()}`)
    }
  }

  return (
    <FeatureProvider>
      <BreadcrumbOverrideProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              {children}
            </div>
            <DemoDataBanner />
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbOverrideProvider>
    </FeatureProvider>
  )
}


