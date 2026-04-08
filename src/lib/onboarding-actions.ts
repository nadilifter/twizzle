import { db, getScopedDb } from "@/lib/db";
import type { ActionItem, ActionItemsResponse } from "@/types/onboarding";

export async function getActionItems(organizationId: string): Promise<ActionItemsResponse> {
  const scopedDb = getScopedDb(organizationId);

  const [programCount, memberCount, eventCount, websiteConfig, adyenAccount] = await Promise.all([
    scopedDb.program.count(),
    scopedDb.organizationMember.count(),
    scopedDb.event.count(),
    scopedDb.websiteConfig.findFirst({
      select: { isPublished: true },
    }),
    // tenant-isolation-ok: AdyenPlatformAccount is a platform-level model
    db.adyenPlatformAccount.findUnique({
      where: { organizationId },
      select: { onboardingStatus: true },
    }),
  ]);

  const items: ActionItem[] = [
    {
      id: "invite-team",
      title: "Invite team members",
      description: "Add coaches, staff, and other administrators",
      url: "/dashboard/organization/staff",
      isComplete: memberCount > 1,
      icon: "Users",
    },
    {
      id: "create-events",
      title: "Create events and programs",
      description: "Set up your schedule and registration options",
      url: "/dashboard/events",
      isComplete: eventCount > 0 || programCount > 0,
      icon: "Calendar",
    },
    {
      id: "customize-website",
      title: "Customize your website",
      description: "Update your public site with content and branding",
      url: "/dashboard/website",
      isComplete: !!websiteConfig?.isPublished,
      icon: "Globe",
    },
    {
      id: "setup-payments",
      title: "Set up payments",
      description: "Complete Adyen verification to accept payments and receive payouts",
      url: "/dashboard/financials/onboarding",
      isComplete: adyenAccount?.onboardingStatus === "VERIFIED",
      icon: "CreditCard",
    },
  ];

  const completedCount = items.filter((item) => item.isComplete).length;

  return {
    items,
    completedCount,
    totalCount: items.length,
    allComplete: completedCount === items.length,
  };
}
