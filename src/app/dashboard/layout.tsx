import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DemoDataBanner } from "@/components/demo-data-banner";
import { ZendeskWidget } from "@/components/zendesk-widget";
import { BreadcrumbOverrideProvider } from "@/components/breadcrumb-context";
import { BillingGracePeriodBanner } from "@/components/billing-grace-period-banner";
import { CommandPaletteProvider } from "@/components/command-palette";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSubdomainUrl } from "@/lib/env-domains";
import { PageTransition } from "@/components/ui/page-transition";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <BreadcrumbOverrideProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <Suspense fallback={null}>
              <DeactivationGuard />
            </Suspense>
            <div className="flex flex-1 flex-col">
              <PageTransition>{children}</PageTransition>
            </div>
            <DemoDataBanner />
          </SidebarInset>
        </SidebarProvider>
        <ZendeskWidget />
      </BreadcrumbOverrideProvider>
    </CommandPaletteProvider>
  );
}

async function DeactivationGuard() {
  const session = await getAuthSession();
  if (!session?.user?.organizationId || session.user.isSuperAdmin) return null;

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

  return (
    <BillingGracePeriodBanner scheduledDeactivationDate={org?.scheduledDeactivationDate ?? null} />
  );
}
