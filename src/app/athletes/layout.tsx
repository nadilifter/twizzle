import { AthletesSidebar } from "@/components/athletes-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BreadcrumbOverrideProvider } from "@/components/breadcrumb-context";
import { UserImpersonationBanner } from "@/components/user-impersonation-banner";
import { WaitlistPaymentBanner } from "@/components/billing/waitlist-payment-banner";

export default function AthletesLayout({ children }: { children: React.ReactNode }) {
  return (
    <BreadcrumbOverrideProvider>
      <SidebarProvider>
        <AthletesSidebar />
        <SidebarInset>
          <UserImpersonationBanner />
          <WaitlistPaymentBanner />
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </BreadcrumbOverrideProvider>
  );
}
