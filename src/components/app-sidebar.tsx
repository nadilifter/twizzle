"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, LifeBuoy, Send, FlaskConical, CalendarCheck, ShoppingCart, UserCheck, Globe } from "lucide-react"
import { useSession } from "next-auth/react"

import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { OrganizationSwitcher } from "@/components/organization-switcher"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { getFeatureStatus } from "@/lib/feature-status"
import { cn } from "@/lib/utils"
import { getOrganizationWebsiteSubdomain } from "@/app/actions/organization"
import { useFeatures } from "@/components/feature-context"
import { FEATURE_SIDEBAR_MAP, FEATURE_KEYS, type FeatureKey, type FeatureToggles } from "@/lib/feature-toggles"
import type { LucideIcon } from "lucide-react"

type NavSecondaryItem = { title: string; url: string; icon: LucideIcon; external?: boolean }

// Module-level cache survives component remounts during client-side navigation
let navSecondaryCache: { key: string; items: NavSecondaryItem[] } | null = null
let actionItemsCache: { count: number; fetchedAt: number } | null = null

const ACTION_ITEMS_URL = "/dashboard/action-items"
const ACTION_ITEMS_CACHE_MS = 60_000

function ActionItemsBadge() {
  const [incompleteCount, setIncompleteCount] = React.useState(() =>
    actionItemsCache && Date.now() - actionItemsCache.fetchedAt < ACTION_ITEMS_CACHE_MS
      ? actionItemsCache.count
      : 0
  )

  React.useEffect(() => {
    if (actionItemsCache && Date.now() - actionItemsCache.fetchedAt < ACTION_ITEMS_CACHE_MS) {
      setIncompleteCount(actionItemsCache.count)
      return
    }

    let cancelled = false
    fetch("/api/onboarding/action-items")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return
        const count = data.totalCount - data.completedCount
        actionItemsCache = { count, fetchedAt: Date.now() }
        setIncompleteCount(count)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (incompleteCount <= 0) return null

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
      {incompleteCount}
    </span>
  )
}

// Helper to construct subdomain URLs for the access point system
function getAccessPointUrl(subdomain: string, organizationId?: string): string {
  if (typeof window === 'undefined') return `/${subdomain}`
  
  const { hostname, port, protocol } = window.location
  
  // Extract base domain (e.g., from "admin.uplifterinc.localhost" get "uplifterinc.localhost")
  const parts = hostname.split('.')
  if (parts.length >= 3) {
    // Replace the first subdomain with the new one
    parts[0] = subdomain
    const newHostname = parts.join('.')
    const baseUrl = `${protocol}//${newHostname}${port ? ':' + port : ''}`
    
    // Add organizationId as query param if provided
    if (organizationId) {
      return `${baseUrl}?orgId=${encodeURIComponent(organizationId)}`
    }
    return baseUrl
  }
  
  // Fallback to relative path if we can't parse the hostname
  return `/${subdomain}`
}

// Status indicator: show only beta/demo (not live) so sidebar is less noisy
function FeatureStatusIndicator({ url }: { url: string }) {
  const config = getFeatureStatus(url)
  if (!config) return null
  // Hide live indicator; only show beta/demo
  if (config.status === "live") return null
  if (config.status === "demo") {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-auto">
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
      </TooltipProvider>
    )
  }
  // Partial: show only beta indicator
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-auto">
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
    </TooltipProvider>
  )
}

// Navigation data
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      items: [
        {
          title: "Action Items",
          url: "/dashboard/action-items",
        },
        {
          title: "Dashboard",
          url: "/dashboard",
        },
        /*
        {
          title: "Overview",
          url: "/dashboard",
        },
        {
          title: "Analytics",
          url: "/dashboard/analytics",
        },
        */
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
          title: "Passes",
          url: "/dashboard/registrations/passes",
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
        {
          title: "Marketing Site",
          url: "/dashboard/competitions/marketing",
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
          title: "SMS Chat",
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
        {
          title: "Website",
          url: "/dashboard/organization/website",
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
          title: "Users",
          url: "/dashboard/organization/users",
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
}

/**
 * Filter nav items based on feature toggles.
 * Removes entire sections or individual sub-items depending on the mapping.
 */
function filterNavByFeatures(
  navMain: typeof data.navMain,
  features: FeatureToggles
) {
  // Collect sections and sub-items to remove
  const sectionsToRemove = new Set<string>()
  const subItemsToRemove = new Map<string, Set<string>>()

  for (const key of FEATURE_KEYS) {
    if (features[key]) continue // Feature enabled, don't filter
    const mapping = FEATURE_SIDEBAR_MAP[key]
    if (!mapping) continue
    if (mapping.sectionTitle) {
      sectionsToRemove.add(mapping.sectionTitle)
    }
    if (mapping.subItems) {
      for (const { section, items } of mapping.subItems) {
        if (!subItemsToRemove.has(section)) {
          subItemsToRemove.set(section, new Set())
        }
        for (const item of items) {
          subItemsToRemove.get(section)!.add(item)
        }
      }
    }
  }

  return navMain
    .filter((section) => !sectionsToRemove.has(section.title))
    .map((section) => {
      const itemsToRemove = subItemsToRemove.get(section.title)
      if (!itemsToRemove || itemsToRemove.size === 0) return section
      return {
        ...section,
        items: section.items?.filter(
          (item) => !itemsToRemove.has(item.title)
        ),
      }
    })
    .filter((section) => !section.items || section.items.length > 0)
}

/**
 * Filter access point links based on feature toggles.
 */
function filterAccessPointsByFeatures(
  accessPoints: typeof data.navSecondaryAccessPoints,
  features: FeatureToggles
) {
  const titlesToRemove = new Set<string>()
  for (const key of FEATURE_KEYS) {
    if (features[key]) continue
    const mapping = FEATURE_SIDEBAR_MAP[key]
    if (mapping?.accessPoints) {
      for (const title of mapping.accessPoints) {
        titlesToRemove.add(title)
      }
    }
  }
  return accessPoints.filter((item) => !titlesToRemove.has(item.title))
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const { data: session, status } = useSession()
  const { features, isLoaded: isFeaturesLoaded } = useFeatures()

  // Get user data from session
  const user = session?.user ? {
    name: session.user.name || "User",
    email: session.user.email || "",
    avatar: session.user.image || null,
  } : null

  const isLoading = status === "loading"

  // Filter navigation based on feature toggles
  const filteredNavMain = React.useMemo(
    () => filterNavByFeatures(data.navMain, features),
    [features]
  )
  const filteredAccessPoints = React.useMemo(
    () => filterAccessPointsByFeatures(data.navSecondaryAccessPoints, features),
    [features]
  )

  // Compute navSecondary items with proper subdomain URLs
  // Use useState + useEffect to ensure URLs are computed on the client where window is available
  const navSecondaryCacheKey = `${session?.user?.organizationId ?? ""}:${filteredAccessPoints.map(a => a.title).join(",")}`

  const [navSecondary, setNavSecondary] = React.useState<NavSecondaryItem[]>(() => {
    if (navSecondaryCache?.key === navSecondaryCacheKey) return navSecondaryCache.items
    return []
  })
  const [isNavSecondaryLoading, setIsNavSecondaryLoading] = React.useState(() => {
    return navSecondaryCache?.key !== navSecondaryCacheKey
  })
  
  React.useEffect(() => {
    if (!isFeaturesLoaded) return

    if (navSecondaryCache?.key === navSecondaryCacheKey) {
      if (navSecondary.length === 0) setNavSecondary(navSecondaryCache.items)
      setIsNavSecondaryLoading(false)
      return
    }
    
    const organizationId = session?.user?.organizationId

    const computeNavSecondary = async () => {
      const items: NavSecondaryItem[] = []
      
      // Add marketing site link if organization has a published website
      if (organizationId) {
        const websiteSubdomain = await getOrganizationWebsiteSubdomain(organizationId)
        if (websiteSubdomain) {
          items.push({
            title: "Marketing Site",
            url: getAccessPointUrl(websiteSubdomain),
            icon: Globe,
            external: true,
          })
        }
      }
      
      // Add access point items filtered by feature toggles
      const accessPointItems = filteredAccessPoints.map(item => ({
        title: item.title,
        url: getAccessPointUrl(item.subdomain, organizationId || undefined),
        icon: item.icon,
      }))
      
      const staticItems = data.navSecondaryStatic.map(item => ({
        title: item.title,
        url: item.url ?? getAccessPointUrl(item.subdomain!),
        icon: item.icon,
      }))
      
      const result = [...items, ...accessPointItems, ...staticItems]
      navSecondaryCache = { key: navSecondaryCacheKey, items: result }
      setNavSecondary(result)
      setIsNavSecondaryLoading(false)
    }
    
    computeNavSecondary()
  }, [isFeaturesLoaded, session?.user?.organizationId, filteredAccessPoints, navSecondaryCacheKey])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {!isFeaturesLoaded ? (
              Array.from({ length: 6 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton />
                  <SidebarMenuSub>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <SidebarMenuSkeleton key={j} />
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ))
            ) : (
              filteredNavMain.map((item) => (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={isMobile ? (pathname.startsWith(item.url) || item.items?.some(sub => pathname.startsWith(sub.url))) : true}
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
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                              <Link href={subItem.url} className="flex items-center justify-between w-full">
                                <span>{subItem.title}</span>
                                {subItem.url === ACTION_ITEMS_URL ? (
                                  <ActionItemsBadge />
                                ) : (
                                  <FeatureStatusIndicator url={subItem.url} />
                                )}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))
            )}
          </SidebarMenu>
        </SidebarGroup>
        <NavSecondary items={navSecondary} isLoading={isNavSecondaryLoading} className="mt-auto" />
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
          <NavUser user={user} />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
