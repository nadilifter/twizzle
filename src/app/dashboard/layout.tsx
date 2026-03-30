import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DemoDataBanner } from "@/components/demo-data-banner";
import { FeatureProvider } from "@/components/feature-context";
import { ZendeskWidget } from "@/components/zendesk-widget";
import { BreadcrumbOverrideProvider } from "@/components/breadcrumb-context";
import { BillingGracePeriodBanner } from "@/components/billing-grace-period-banner";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSubdomainUrl } from "@/lib/env-domains";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();

  let scheduledDeactivationDate: Date | null = null;

  if (session?.user?.organizationId && !session.user.isSuperAdmin) {
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        isActive: true,
        name: true,
        deactivationReason: true,
        scheduledDeactivationDate: true,
      },
    });

    if (org && !org.isActive) {
      const params = new URLSearchParams({
        reason: org.deactivationReason || "Unknown",
        org: org.name,
        orgId: session.user.organizationId,
      });
      const loginBase = getSubdomainUrl("login");
      redirect(`${loginBase}/organization-deactivated?${params.toString()}`);
    }

    scheduledDeactivationDate = org?.scheduledDeactivationDate ?? null;
  }

  return (
    <FeatureProvider>
      <BreadcrumbOverrideProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <BillingGracePeriodBanner scheduledDeactivationDate={scheduledDeactivationDate} />
            <div className="flex flex-1 flex-col">{children}</div>
            <DemoDataBanner />
          </SidebarInset>
        </SidebarProvider>
        <ZendeskWidget />
      </BreadcrumbOverrideProvider>
    </FeatureProvider>
  );
}
