import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

// Layout for organization selection - doesn't require organizationId
export default async function POSSelectOrgLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();

  // Auth should be handled by parent layout, but double-check
  if (!session) {
    redirect("/login?callbackUrl=/pos");
  }

  // If user already has an organization, redirect to POS terminal
  if (session.user.organizationId) {
    redirect("/pos");
  }

  return <>{children}</>;
}
