import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { FeatureProvider } from "@/components/feature-context"
import { BreadcrumbOverrideProvider } from "@/components/breadcrumb-context"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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


