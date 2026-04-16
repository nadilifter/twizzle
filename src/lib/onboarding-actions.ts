import { db, getScopedDb } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import type { ActionItem, ActionItemsResponse } from "@/types/onboarding";

export async function getActionItems(organizationId: string): Promise<ActionItemsResponse> {
  const scopedDb = getScopedDb(organizationId);

  const [
    programCount,
    memberCount,
    seasonCount,
    categoryCount,
    levelCount,
    waiverCount,
    websiteConfig,
    adyenAccount,
    seasonsEnabled,
  ] = await Promise.all([
    scopedDb.program.count(),
    scopedDb.organizationMember.count(),
    scopedDb.season.count(),
    scopedDb.category.count(),
    scopedDb.level.count(),
    scopedDb.waiver.count(),
    scopedDb.websiteConfig.findFirst({
      select: { isPublished: true },
    }),
    // tenant-isolation-ok: AdyenPlatformAccount is a platform-level model
    db.adyenPlatformAccount.findUnique({
      where: { organizationId },
      select: { onboardingStatus: true },
    }),
    isFeatureEnabled(organizationId, "seasons"),
  ]);

  const items: ActionItem[] = [
    {
      id: "setup-payments",
      title: "Set up payments",
      description: "Payment processing must be set up before this site can go live",
      url: "/dashboard/financials/onboarding",
      isComplete: adyenAccount?.onboardingStatus === "VERIFIED",
      icon: "CreditCard",
    },
    {
      id: "invite-team",
      title: "Invite team members",
      description: "Add coaches, staff, and other administrators",
      url: "/dashboard/organization/staff",
      isComplete: memberCount > 1,
      icon: "Users",
    },
    ...(seasonsEnabled
      ? [
          {
            id: "create-season",
            title: "Create a season",
            description: "Group programs and memberships into recurring seasons",
            url: "/dashboard/registrations/seasons",
            isComplete: seasonCount > 0,
            icon: "Calendar",
          },
        ]
      : []),
    {
      id: "create-category",
      title: "Create a registration category",
      description: "Organize programs and events into browsable categories",
      url: "/dashboard/registrations/categories",
      isComplete: categoryCount > 0,
      icon: "FolderOpen",
    },
    {
      id: "setup-levels",
      title: "Set up training levels",
      description: "Define skill levels for athlete placement and progression",
      url: "/dashboard/training/levels",
      isComplete: levelCount > 0,
      icon: "GraduationCap",
    },
    {
      id: "setup-waivers",
      title: "Set up waivers",
      description: "Create liability waivers for program registration",
      url: "/dashboard/athletes/waivers",
      isComplete: waiverCount > 0,
      icon: "FileCheck",
    },
    {
      id: "create-programs",
      title: "Create a program",
      description: "Set up your schedule and registration options",
      url: "/dashboard/registrations/programs",
      isComplete: programCount > 0,
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
  ];

  const completedCount = items.filter((item) => item.isComplete).length;

  return {
    items,
    completedCount,
    totalCount: items.length,
    allComplete: completedCount === items.length,
  };
}
