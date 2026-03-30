import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserOrganizations } from "@/app/actions/organization";
import { POSSidebar } from "@/components/pos-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function POSTerminalLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();

  // Auth should be handled by parent layout, but double-check
  if (!session) {
    redirect("/login?callbackUrl=/pos");
  }

  // If no organizationId in session, need to select one
  if (!session.user.organizationId) {
    const userOrgs = await getUserOrganizations();

    if (userOrgs.length === 0) {
      // User has no organizations - redirect to onboarding or error
      redirect("/onboarding");
    } else if (userOrgs.length === 1) {
      // Single organization - redirect to select-organization for auto-selection
      redirect(`/pos/select-organization?preselect=${encodeURIComponent(userOrgs[0].id)}`);
    } else {
      // Multiple organizations - redirect to selection page
      redirect("/pos/select-organization");
    }
  }

  // Get organization name for display
  const organization = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { name: true },
  });

  return (
    <SidebarProvider className="!min-h-svh !h-svh !max-h-svh">
      <POSSidebar organizationName={organization?.name} />
      <SidebarInset className="!h-full overflow-hidden">
        <SiteHeader />
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
