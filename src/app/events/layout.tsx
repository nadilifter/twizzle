import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { EventsSidebar } from "@/components/events-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FeatureUnavailablePage } from "@/components/feature-unavailable-page";

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login?callbackUrl=/events");
  }

  const eventsEnabled = await isFeatureEnabled(session.user.organizationId, "events");
  if (!eventsEnabled) {
    return <FeatureUnavailablePage feature="events" />;
  }

  return (
    <SidebarProvider>
      <EventsSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
