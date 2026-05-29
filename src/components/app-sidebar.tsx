"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  LifeBuoy,
  Send,
  FlaskConical,
  CalendarCheck,
  ShoppingCart,
  UserCheck,
  Globe,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { useSession } from "next-auth/react";

import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { ReferAndSaveDialog } from "@/components/refer-and-save-dialog";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { useCommandPalette } from "@/components/command-palette";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeatureStatus } from "@/lib/feature-status";
import { getOrganizationWebsiteSubdomain } from "@/app/actions/organization";
import { useFeatures } from "@/components/feature-context";
import {
  FEATURE_SIDEBAR_MAP,
  FEATURE_KEYS,
  type FeatureKey,
  type FeatureToggles,
} from "@/lib/feature-toggles";
import { Label } from "@/components/ui/label";
import { useSidebarSearch, type SidebarSearchResults } from "@/hooks/use-sidebar-search";
import type { LucideIcon } from "lucide-react";

type NavSecondaryItem = { title: string; url: string; icon: LucideIcon; external?: boolean };

const CHAT_URL = "/dashboard/communication/chat";
const CHAT_UNREAD_CACHE_MS = 60_000;
let chatUnreadCache: { count: number; fetchedAt: number } | null = null;

function ChatUnreadBadge() {
  const [count, setCount] = React.useState(() =>
    chatUnreadCache && Date.now() - chatUnreadCache.fetchedAt < CHAT_UNREAD_CACHE_MS
      ? chatUnreadCache.count
      : 0
  );

  React.useEffect(() => {
    if (chatUnreadCache && Date.now() - chatUnreadCache.fetchedAt < CHAT_UNREAD_CACHE_MS) {
      setCount(chatUnreadCache.count);
      return;
    }

    let cancelled = false;
    fetch("/api/chat/unread-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        chatUnreadCache = { count: data.unreadCount, fetchedAt: Date.now() };
        setCount(data.unreadCount);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
      {count}
    </span>
  );
}

// Module-level cache survives component remounts during client-side navigation
let navSecondaryCache: { key: string; items: NavSecondaryItem[] } | null = null;
let actionItemsCache: { count: number; fetchedAt: number } | null = null;

const DASHBOARD_URL = "/dashboard";
const ACTION_ITEMS_CACHE_MS = 60_000;

function ActionItemsBadge() {
  const [incompleteCount, setIncompleteCount] = React.useState(() =>
    actionItemsCache && Date.now() - actionItemsCache.fetchedAt < ACTION_ITEMS_CACHE_MS
      ? actionItemsCache.count
      : 0
  );

  React.useEffect(() => {
    if (actionItemsCache && Date.now() - actionItemsCache.fetchedAt < ACTION_ITEMS_CACHE_MS) {
      setIncompleteCount(actionItemsCache.count);
      return;
    }

    let cancelled = false;
    fetch("/api/onboarding/action-items")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const count = data.totalCount - data.completedCount;
        actionItemsCache = { count, fetchedAt: Date.now() };
        setIncompleteCount(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (incompleteCount <= 0) return null;

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
      {incompleteCount}
    </span>
  );
}

// Helper to construct subdomain URLs for the access point system
function getAccessPointUrl(subdomain: string, organizationId?: string): string {
  if (typeof window === "undefined") return `/${subdomain}`;

  const { hostname, port, protocol } = window.location;

  // Extract base domain (e.g., from "admin.twizzle.localhost" get "twizzle.localhost")
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    // Replace the first subdomain with the new one
    parts[0] = subdomain;
    const newHostname = parts.join(".");
    const baseUrl = `${protocol}//${newHostname}${port ? ":" + port : ""}`;

    // Add organizationId as query param if provided
    if (organizationId) {
      return `${baseUrl}?orgId=${encodeURIComponent(organizationId)}`;
    }
    return baseUrl;
  }

  // Fallback to relative path if we can't parse the hostname
  return `/${subdomain}`;
}

// Status indicator: show only beta/demo (not live) so sidebar is less noisy
function FeatureStatusIndicator({ url }: { url: string }) {
  const config = getFeatureStatus(url);
  if (!config) return null;
  // Hide live indicator; only show beta/demo
  if (config.status === "live") return null;
  if (config.status === "demo") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-auto shrink-0">
            <FlaskConical className="h-3 w-3 text-amber-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="font-medium text-xs">Beta</p>
          <p className="text-xs opacity-80">
            {config.description || "Using sample data for preview"}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }
  // Partial: show only beta indicator
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-auto shrink-0">
          <FlaskConical className="h-3 w-3 text-amber-500" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px]">
        <p className="font-medium text-xs">Beta</p>
        <p className="text-xs opacity-80">
          {config.description || "Some features use real data, others are in beta"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// Navigation data
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
        },
        /*
        {
          title: "Overview",
          url: "/dashboard",
        },
        */
        {
          title: "Analytics",
          url: "/dashboard/analytics",
        },
      ],
    },
    {
      title: "Athletes",
      url: "/dashboard/athletes",
      items: [
        {
          title: "Directory",
          url: "/dashboard/athletes",
        },
        {
          title: "Attendance",
          url: "/dashboard/athletes/attendance",
        },
        {
          title: "Guardians",
          url: "/dashboard/athletes/guardians",
        },
        {
          title: "Questions",
          url: "/dashboard/athletes/questions",
        },
        {
          title: "Medical Forms",
          url: "/dashboard/athletes/medical",
        },
        {
          title: "Memberships",
          url: "/dashboard/athletes/memberships",
        },
        {
          title: "Waivers",
          url: "/dashboard/athletes/waivers",
        },
      ],
    },
    {
      title: "Registrations",
      url: "/dashboard/registrations",
      items: [
        {
          title: "Events",
          url: "/dashboard/events",
        },
        {
          title: "Programs",
          url: "/dashboard/registrations/programs",
        },
        {
          title: "Categories",
          url: "/dashboard/registrations/categories",
        },
        {
          title: "Seasons",
          url: "/dashboard/registrations/seasons",
        },
        {
          title: "Passes",
          url: "/dashboard/registrations/passes",
        },
        {
          title: "Holidays",
          url: "/dashboard/registrations/holidays",
        },
        {
          title: "Queues",
          url: "/dashboard/registrations/queues",
        },
      ],
    },
    {
      title: "Competitions",
      url: "/dashboard/competitions",
      items: [
        {
          title: "Competitions",
          url: "/dashboard/competitions",
        },
        {
          title: "Categories",
          url: "/dashboard/competitions/categories",
        },
        {
          title: "Results",
          url: "/dashboard/competitions/results",
        },
      ],
    },
    {
      title: "Training",
      url: "/dashboard/training",
      items: [
        {
          title: "Skills",
          url: "/dashboard/training/skills",
        },
        {
          title: "Evaluations",
          url: "/dashboard/training/evaluations",
        },
        {
          title: "Levels",
          url: "/dashboard/training/levels",
        },
      ],
    },
    {
      title: "Communication",
      url: "/dashboard/communication",
      items: [
        {
          title: "Announcements",
          url: "/dashboard/communication/announcements",
        },
        {
          title: "Email Campaigns",
          url: "/dashboard/communication/email",
        },
        {
          title: "SMS Campaigns",
          url: "/dashboard/communication/sms",
        },
        {
          title: "Chat",
          url: "/dashboard/communication/chat",
        },
        {
          title: "Notifications",
          url: "/dashboard/communication/notifications",
        },
      ],
    },
    {
      title: "My Organization",
      url: "/dashboard/organization",
      items: [
        {
          title: "Overview",
          url: "/dashboard/organization/overview",
        },
        {
          title: "Facilities",
          url: "/dashboard/organization/facilities",
        },
        {
          title: "Schedules",
          url: "/dashboard/organization/schedules",
        },
        {
          title: "Certifications",
          url: "/dashboard/organization/certifications",
        },
      ],
    },
    {
      title: "Website",
      url: "/dashboard/website",
      items: [
        {
          title: "General",
          url: "/dashboard/website",
        },
        {
          title: "Pages",
          url: "/dashboard/website/pages",
        },
        {
          title: "Competitions",
          url: "/dashboard/website/competitions",
        },
        {
          title: "Team",
          url: "/dashboard/website/team",
        },
      ],
    },
    {
      title: "Store",
      url: "/dashboard/store",
      items: [
        {
          title: "Products",
          url: "/dashboard/store/products",
        },
        {
          title: "Orders",
          url: "/dashboard/store/orders",
        },
      ],
    },
    {
      title: "Financials",
      url: "/dashboard/financials",
      items: [
        {
          title: "Overview",
          url: "/dashboard/financials",
        },
        {
          title: "Discounts",
          url: "/dashboard/financials/discounts",
        },
        {
          title: "Integrations",
          url: "/dashboard/financials/integrations",
        },
        {
          title: "Invoices",
          url: "/dashboard/financials/invoices",
        },
        {
          title: "Ledgers",
          url: "/dashboard/financials/ledgers",
        },
        {
          title: "Onboarding",
          url: "/dashboard/financials/onboarding",
        },
        {
          title: "Payouts",
          url: "/dashboard/financials/payouts",
        },
        {
          title: "Recurring Billing",
          url: "/dashboard/financials/recurring",
        },
        {
          title: "Taxes & Fees",
          url: "/dashboard/financials/taxes-and-fees",
        },
        {
          title: "Transactions",
          url: "/dashboard/financials/transactions",
        },
      ],
    },
    /*
    {
      title: "Forms",
      url: "/dashboard/forms",
      items: [],
    },
    {
      title: "Campaigns",
      url: "/campaigns",
      items: [
        {
          title: "Advertising",
          url: "/campaigns/advertising",
        },
        {
          title: "Donation",
          url: "/campaigns/donation",
        },
        {
          title: "Merchandise",
          url: "/campaigns/merchandise",
        },
        {
          title: "Sponsorship",
          url: "/campaigns/sponsorship",
        },
      ],
    },
    */
    {
      title: "Reports",
      url: "/dashboard/reports",
      items: [
        {
          title: "All Reports",
          url: "/dashboard/reports",
        },
        {
          title: "Accounts Receivable",
          url: "/dashboard/reports/accounts-receivable",
        },
        {
          title: "Attendance",
          url: "/dashboard/reports/attendance",
        },
        {
          title: "Enrollment Summary",
          url: "/dashboard/reports/enrollment",
        },
        {
          title: "Membership Growth",
          url: "/dashboard/reports/membership-growth",
        },
        {
          title: "Program Details",
          url: "/dashboard/reports/program-performance",
        },
        {
          title: "Retention & Churn",
          url: "/dashboard/reports/retention",
        },
        {
          title: "Revenue Summary",
          url: "/dashboard/reports/revenue",
        },
        {
          title: "Tax Collection",
          url: "/dashboard/reports/tax-collection",
        },
      ],
    },
    {
      title: "Usage",
      url: "/dashboard/usage",
      items: [
        {
          title: "Email",
          url: "/dashboard/usage/email",
        },
        {
          title: "SMS",
          url: "/dashboard/usage/sms",
        },
        {
          title: "Storage",
          url: "/dashboard/usage/storage",
        },
      ],
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      items: [
        {
          title: "Billing",
          url: "/dashboard/usage/billing",
        },
        {
          title: "Features",
          url: "/dashboard/organization/features",
        },
        {
          title: "Staff",
          url: "/dashboard/organization/staff",
        },
      ],
    },
  ],
  // Access point links - subdomain field is used to construct full URLs
  navSecondaryAccessPoints: [
    {
      title: "Events Portal",
      subdomain: "events",
      icon: CalendarCheck,
    },
    {
      title: "Point of Sale",
      subdomain: "pos",
      icon: ShoppingCart,
    },
    {
      title: "Coach Portal",
      subdomain: "coach",
      icon: UserCheck,
    },
  ],
  // External and static links
  navSecondaryStatic: [
    {
      title: "Support",
      url: "https://www.uplifterinc.com/contact-us",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      subdomain: "feedback",
      icon: Send,
    },
  ],
};

/**
 * Filter nav items based on feature toggles.
 * Removes entire sections or individual sub-items depending on the mapping.
 */
function filterNavByFeatures(navMain: typeof data.navMain, features: FeatureToggles) {
  // Collect sections and sub-items to remove
  const sectionsToRemove = new Set<string>();
  const subItemsToRemove = new Map<string, Set<string>>();

  for (const key of FEATURE_KEYS) {
    if (features[key]) continue; // Feature enabled, don't filter
    const mapping = FEATURE_SIDEBAR_MAP[key];
    if (!mapping) continue;
    if (mapping.sectionTitle) {
      sectionsToRemove.add(mapping.sectionTitle);
    }
    if (mapping.subItems) {
      for (const { section, items } of mapping.subItems) {
        if (!subItemsToRemove.has(section)) {
          subItemsToRemove.set(section, new Set());
        }
        for (const item of items) {
          subItemsToRemove.get(section)!.add(item);
        }
      }
    }
  }

  return navMain
    .filter((section) => !sectionsToRemove.has(section.title))
    .map((section) => {
      const itemsToRemove = subItemsToRemove.get(section.title);
      if (!itemsToRemove || itemsToRemove.size === 0) return section;
      return {
        ...section,
        items: section.items?.filter((item) => !itemsToRemove.has(item.title)),
      };
    })
    .filter((section) => !section.items || section.items.length > 0);
}

/**
 * Filter access point links based on feature toggles.
 */
function filterAccessPointsByFeatures(
  accessPoints: typeof data.navSecondaryAccessPoints,
  features: FeatureToggles
) {
  const titlesToRemove = new Set<string>();
  for (const key of FEATURE_KEYS) {
    if (features[key]) continue;
    const mapping = FEATURE_SIDEBAR_MAP[key];
    if (mapping?.accessPoints) {
      for (const title of mapping.accessPoints) {
        titlesToRemove.add(title);
      }
    }
  }
  return accessPoints.filter((item) => !titlesToRemove.has(item.title));
}

const ENTITY_SECTIONS: {
  key: keyof SidebarSearchResults;
  label: string;
  urlPrefix: string;
  linkToDetail: boolean;
}[] = [
  {
    key: "staff",
    label: "Staff",
    urlPrefix: "/dashboard/organization/staff/",
    linkToDetail: true,
  },
  {
    key: "guardians",
    label: "Guardians",
    urlPrefix: "/dashboard/athletes/guardians/",
    linkToDetail: true,
  },
  {
    key: "athletes",
    label: "Athletes",
    urlPrefix: "/dashboard/athletes/",
    linkToDetail: true,
  },
  {
    key: "programs",
    label: "Programs",
    urlPrefix: "/dashboard/registrations/programs/",
    linkToDetail: true,
  },
  { key: "events", label: "Events", urlPrefix: "/dashboard/events/", linkToDetail: true },
  {
    key: "competitions",
    label: "Competitions",
    urlPrefix: "/dashboard/competitions/",
    linkToDetail: true,
  },
  {
    key: "memberships",
    label: "Memberships",
    urlPrefix: "/dashboard/athletes/memberships",
    linkToDetail: false,
  },
  {
    key: "categories",
    label: "Categories",
    urlPrefix: "/dashboard/registrations/categories/",
    linkToDetail: true,
  },
  {
    key: "seasons",
    label: "Seasons",
    urlPrefix: "/dashboard/registrations/seasons/",
    linkToDetail: true,
  },
];

function EntitySearchResults({
  results,
  isLoading,
  show,
  isHighlighted,
  highlightedItemRef,
}: {
  results: SidebarSearchResults;
  isLoading: boolean;
  show: boolean;
  isHighlighted: (sectionKey: string, entityId: string) => boolean;
  highlightedItemRef: React.RefObject<HTMLLIElement>;
}) {
  if (!show) return null;

  const hasResults = ENTITY_SECTIONS.some((s) => results[s.key].length > 0);

  if (isLoading && !hasResults) {
    return (
      <SidebarGroup>
        <SidebarMenu>
          {Array.from({ length: 2 }).map((_, i) => (
            <SidebarMenuItem key={i}>
              <SidebarMenuSkeleton />
              <SidebarMenuSub>
                <SidebarMenuSkeleton />
                <SidebarMenuSkeleton />
              </SidebarMenuSub>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  if (!hasResults) return null;

  return (
    <SidebarGroup>
      <SidebarMenu>
        {ENTITY_SECTIONS.map((section) => {
          const items = results[section.key];
          if (items.length === 0) return null;
          return (
            <SidebarMenuItem key={section.key}>
              <SidebarMenuButton className="pointer-events-none">
                <span className="font-medium">{section.label}</span>
                {isLoading && (
                  <Loader2 className="ml-auto size-3 animate-spin text-muted-foreground" />
                )}
              </SidebarMenuButton>
              <SidebarMenuSub>
                {items.map((entity) => {
                  const highlighted = isHighlighted(section.key, entity.id);
                  return (
                    <SidebarMenuSubItem
                      key={entity.id}
                      ref={highlighted ? highlightedItemRef : undefined}
                    >
                      <SidebarMenuSubButton asChild isActive={highlighted}>
                        <Link
                          href={
                            section.linkToDetail
                              ? `${section.urlPrefix}${entity.id}`
                              : section.urlPrefix
                          }
                        >
                          <span>{entity.name}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { data: session, status } = useSession();
  const { features, isLoaded: isFeaturesLoaded } = useFeatures();
  const { open: openCommandPalette } = useCommandPalette();

  // Get user data from session
  const user = session?.user
    ? {
        name: session.user.name || "User",
        email: session.user.email || "",
        avatar: session.user.image || null,
        avatarCrop: session.user.avatarCrop || null,
      }
    : null;

  const isLoading = status === "loading";

  // Search state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  // Accordion state: only one section can be expanded at a time. null = all collapsed.
  const [openSection, setOpenSection] = React.useState<string | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const highlightedItemRef = React.useRef<HTMLLIElement>(null);
  const { results: entityResults, isLoading: isEntitySearchLoading } =
    useSidebarSearch(searchQuery);

  // Cmd+K is handled globally by CommandPaletteProvider; clicking the
  // kbd hint in the sidebar search also opens the palette for discoverability.
  const handleSearchKbdClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      openCommandPalette();
    },
    [openCommandPalette]
  );

  const [isMac, setIsMac] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  // Filter navigation based on feature toggles
  const filteredNavMain = React.useMemo(
    () => filterNavByFeatures(data.navMain, features),
    [features]
  );

  // Eagerly prefetch every sidebar sub-item so first-click navigation is instant.
  // Sections are collapsed by default, so the <Link> components inside CollapsibleContent
  // don't mount and Next.js's viewport-triggered prefetch never fires. Trigger it manually.
  React.useEffect(() => {
    if (!isFeaturesLoaded) return;
    for (const section of filteredNavMain) {
      for (const subItem of section.items ?? []) {
        router.prefetch(subItem.url);
      }
    }
  }, [isFeaturesLoaded, filteredNavMain, router]);

  // Instant frontend filtering of nav items based on search query
  const searchFilteredNav = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredNavMain;

    return filteredNavMain
      .map((section) => {
        const sectionMatches = section.title.toLowerCase().includes(q);
        if (sectionMatches) return section;
        const matchingItems = section.items?.filter((item) => item.title.toLowerCase().includes(q));
        if (matchingItems && matchingItems.length > 0) {
          return { ...section, items: matchingItems };
        }
        return null;
      })
      .filter(Boolean) as typeof filteredNavMain;
  }, [filteredNavMain, searchQuery]);

  const isSearchActive = searchQuery.trim().length > 0;

  const { navigableItems, indexByItem } = React.useMemo(() => {
    const items: { url: string }[] = [];
    const map = new Map<string, number>();
    if (!isSearchActive) return { navigableItems: items, indexByItem: map };

    for (const section of searchFilteredNav) {
      for (const subItem of section.items ?? []) {
        map.set(`nav:${section.title}:${subItem.title}`, items.length);
        items.push({ url: subItem.url });
      }
    }
    for (const section of ENTITY_SECTIONS) {
      for (const entity of entityResults[section.key]) {
        const url = section.linkToDetail ? `${section.urlPrefix}${entity.id}` : section.urlPrefix;
        map.set(`entity:${section.key}:${entity.id}`, items.length);
        items.push({ url });
      }
    }
    return { navigableItems: items, indexByItem: map };
  }, [isSearchActive, searchFilteredNav, entityResults]);

  // Reset highlight to first result whenever the query changes.
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Clamp highlight when the results list shrinks (e.g. async entity results settle).
  React.useEffect(() => {
    setHighlightedIndex((idx) => {
      if (navigableItems.length === 0) return 0;
      return idx >= navigableItems.length ? navigableItems.length - 1 : idx;
    });
  }, [navigableItems.length]);

  // Keep the highlighted item in view as the user arrows through results.
  React.useEffect(() => {
    highlightedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (searchQuery) {
        e.preventDefault();
        setSearchQuery("");
      } else {
        searchInputRef.current?.blur();
      }
      return;
    }
    if (navigableItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % navigableItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + navigableItems.length) % navigableItems.length);
    } else if (e.key === "Enter") {
      const target = navigableItems[highlightedIndex];
      const anchor = highlightedItemRef.current?.querySelector("a");
      if (target && anchor) {
        e.preventDefault();
        anchor.click();
      } else if (target) {
        e.preventDefault();
        router.push(target.url);
      }
    }
  };

  const filteredAccessPoints = React.useMemo(() => {
    const featureFiltered = filterAccessPointsByFeatures(data.navSecondaryAccessPoints, features);
    // Permission-gate the Coach Portal cross-link: only users who actually
    // have access to /coach should see this. Pure admins (no coaching.portal
    // perm) would land on a 403 anyway.
    const permissions = session?.user?.permissions ?? [];
    const hasCoachAccess =
      session?.user?.role === "COACH" ||
      permissions.includes("*") ||
      permissions.includes("coaching.portal");
    return featureFiltered.filter((item) => item.title !== "Coach Portal" || hasCoachAccess);
  }, [features, session?.user?.role, session?.user?.permissions]);

  // Track website subdomain as reactive state so the Marketing Site link hides immediately
  // when the website is unpublished (e.g. on Adyen verification regression).
  // undefined = still fetching, null = not published, string = published subdomain
  const [websiteSubdomain, setWebsiteSubdomain] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const organizationId = session?.user?.organizationId;
    if (!organizationId) {
      setWebsiteSubdomain(null);
      return;
    }
    let cancelled = false;
    getOrganizationWebsiteSubdomain(organizationId)
      .then((subdomain) => {
        if (!cancelled) setWebsiteSubdomain(subdomain);
      })
      .catch(() => {
        if (!cancelled) setWebsiteSubdomain(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.organizationId, pathname]);

  // Compute navSecondary items with proper subdomain URLs
  // Use useState + useEffect to ensure URLs are computed on the client where window is available
  // Include websiteSubdomain in the key so the cache busts when publish state changes
  const navSecondaryCacheKey = `${session?.user?.organizationId ?? ""}:${websiteSubdomain ?? "none"}:${filteredAccessPoints.map((a) => a.title).join(",")}`;

  const [navSecondary, setNavSecondary] = React.useState<NavSecondaryItem[]>(() => {
    if (navSecondaryCache?.key === navSecondaryCacheKey) return navSecondaryCache.items;
    return [];
  });
  const [isNavSecondaryLoading, setIsNavSecondaryLoading] = React.useState(() => {
    return navSecondaryCache?.key !== navSecondaryCacheKey;
  });

  React.useEffect(() => {
    if (!isFeaturesLoaded || websiteSubdomain === undefined) return;

    if (navSecondaryCache?.key === navSecondaryCacheKey) {
      if (navSecondary.length === 0) setNavSecondary(navSecondaryCache.items);
      setIsNavSecondaryLoading(false);
      return;
    }

    const organizationId = session?.user?.organizationId;

    const computeNavSecondary = () => {
      const items: NavSecondaryItem[] = [];

      // Add marketing site link if organization has a published website
      if (websiteSubdomain) {
        items.push({
          title: "Marketing Site",
          url: getAccessPointUrl(websiteSubdomain),
          icon: Globe,
          external: true,
        });
      }

      // Add access point items filtered by feature toggles
      const accessPointItems = filteredAccessPoints.map((item) => ({
        title: item.title,
        url: getAccessPointUrl(item.subdomain, organizationId || undefined),
        icon: item.icon,
      }));

      const staticItems = data.navSecondaryStatic.map((item) => ({
        title: item.title,
        url: item.url ?? getAccessPointUrl(item.subdomain!),
        icon: item.icon,
      }));

      const result = [...items, ...accessPointItems, ...staticItems];
      navSecondaryCache = { key: navSecondaryCacheKey, items: result };
      setNavSecondary(result);
      setIsNavSecondaryLoading(false);
    };

    computeNavSecondary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isFeaturesLoaded,
    websiteSubdomain,
    session?.user?.organizationId,
    filteredAccessPoints,
    navSecondaryCacheKey,
  ]);

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pb-0 pt-1">
          <SidebarGroupContent className="relative">
            {!isFeaturesLoaded ? (
              <Skeleton className="h-8 w-full rounded-md" />
            ) : (
              <>
                <Label htmlFor="sidebar-search" className="sr-only">
                  Search
                </Label>
                <SidebarInput
                  ref={searchInputRef}
                  id="sidebar-search"
                  placeholder="Search..."
                  className="pl-8 pr-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 opacity-50 select-none" />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm opacity-50 hover:opacity-100"
                  >
                    <X className="size-4" />
                    <span className="sr-only">Clear search</span>
                  </button>
                ) : (
                  isMac !== null && (
                    <button
                      type="button"
                      onClick={handleSearchKbdClick}
                      aria-label="Open command palette"
                      className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex"
                    >
                      <kbd className="flex h-5 cursor-pointer select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground hover:bg-accent">
                        {isMac ? (
                          <>
                            <span className="text-[9px]">⌘</span>K
                          </>
                        ) : (
                          "Ctrl+K"
                        )}
                      </kbd>
                    </button>
                  )
                )}
              </>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        {(!isFeaturesLoaded || searchFilteredNav.length > 0) && (
          <SidebarGroup>
            <SidebarMenu>
              {!isFeaturesLoaded
                ? Array.from({ length: 6 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton />
                      <SidebarMenuSub>
                        {Array.from({ length: 3 }).map((_, j) => (
                          <SidebarMenuSkeleton key={j} />
                        ))}
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  ))
                : searchFilteredNav.map((item) => (
                    <Collapsible
                      key={item.title}
                      asChild
                      open={searchQuery ? true : openSection === item.title}
                      onOpenChange={(isOpen) => {
                        if (searchQuery) return;
                        setOpenSection(isOpen ? item.title : null);
                      }}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            <span className="font-medium">{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items?.map((subItem) => {
                              const navIdx = indexByItem.get(`nav:${item.title}:${subItem.title}`);
                              const isSearchHighlighted =
                                isSearchActive && navIdx === highlightedIndex;
                              return (
                                <SidebarMenuSubItem
                                  key={subItem.title}
                                  ref={isSearchHighlighted ? highlightedItemRef : undefined}
                                >
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isSearchHighlighted || pathname === subItem.url}
                                  >
                                    <Link
                                      href={subItem.url}
                                      className="flex items-center justify-between w-full"
                                    >
                                      <span>{subItem.title}</span>
                                      {subItem.url === DASHBOARD_URL ? (
                                        <ActionItemsBadge />
                                      ) : subItem.url === CHAT_URL ? (
                                        <ChatUnreadBadge />
                                      ) : (
                                        <FeatureStatusIndicator url={subItem.url} />
                                      )}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
        <EntitySearchResults
          results={entityResults}
          isLoading={isEntitySearchLoading}
          show={searchQuery.trim().length >= 2}
          isHighlighted={(sectionKey, entityId) =>
            isSearchActive &&
            indexByItem.get(`entity:${sectionKey}:${entityId}`) === highlightedIndex
          }
          highlightedItemRef={highlightedItemRef}
        />
        {searchQuery.trim() &&
          isFeaturesLoaded &&
          searchFilteredNav.length === 0 &&
          !isEntitySearchLoading &&
          !ENTITY_SECTIONS.some((s) => entityResults[s.key].length > 0) && (
            <div className="px-4 py-6 text-center text-sm text-sidebar-foreground">
              No results found
            </div>
          )}
        <NavSecondary items={navSecondary} isLoading={isNavSecondaryLoading} className="mt-auto">
          <SidebarMenuItem>
            <ReferAndSaveDialog />
          </SidebarMenuItem>
        </NavSecondary>
      </SidebarContent>
      <SidebarFooter>
        {isLoading || !user ? (
          <div className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : (
          <NavUser user={user} accountUrl="/athletes/account" />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
