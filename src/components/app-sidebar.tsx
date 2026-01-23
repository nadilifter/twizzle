"use client"

import * as React from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ChevronRight, LifeBuoy, Send, ShieldCheck } from "lucide-react"
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

// Navigation data
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      items: [
        {
          title: "Overview",
          url: "/dashboard",
        },
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
          title: "Attendance",
          url: "/dashboard/athletes/attendance",
        },
        {
          title: "Directory",
          url: "/dashboard/athletes",
        },
        {
          title: "Families",
          url: "/dashboard/athletes/families",
        },
        {
          title: "Memberships",
          url: "/dashboard/athletes/memberships",
        },
      ],
    },
    {
      title: "Training",
      url: "/dashboard/training",
      items: [
        {
          title: "Overview",
          url: "/dashboard/training",
        },
        {
          title: "Plans",
          url: "/dashboard/training/plans",
        },
        {
          title: "Programs",
          url: "/dashboard/training/programs",
        },
        {
          title: "Rotations",
          url: "/dashboard/training/rotations",
        },
        {
          title: "Skills",
          url: "/dashboard/training/skills",
        },
      ],
    },
    {
      title: "Events",
      url: "/dashboard/events",
      items: [
        {
          title: "Calendar",
          url: "/dashboard/events/calendar",
        },
        {
          title: "Upcoming",
          url: "/dashboard/events",
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
          title: "Chat",
          url: "/dashboard/communication/chat",
        },
        {
          title: "Email",
          url: "/dashboard/communication/email",
        },
        {
          title: "Notifications",
          url: "/dashboard/communication/notifications",
        },
        {
          title: "SMS",
          url: "/dashboard/communication/sms",
        },
      ],
    },
    {
      title: "My Organization",
      url: "/dashboard/organization",
      items: [
        {
          title: "App",
          url: "/dashboard/organization/app",
        },
        {
          title: "Facility",
          url: "/dashboard/organization/facility",
        },
        {
          title: "Schedules",
          url: "/dashboard/organization/schedules",
        },
        {
          title: "Staff",
          url: "/dashboard/organization/staff",
        },
        {
          title: "Website",
          url: "/dashboard/organization/website",
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
          title: "Point of Sale",
          url: "/dashboard/financials/pos",
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
    {
      title: "Forms",
      url: "/dashboard/forms",
      items: [
        {
          title: "Surveys",
          url: "/dashboard/forms/surveys",
        },
        {
          title: "Waivers",
          url: "/dashboard/forms/waivers",
        },
      ],
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
    {
      title: "Settings",
      url: "/dashboard/settings",
      items: [
        {
          title: "Billing",
          url: "/dashboard/settings/billing",
        },
        {
          title: "Users",
          url: "/dashboard/settings/users",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "https://www.uplifterinc.com/contact-us",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "/dashboard/feedback",
      icon: Send,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const { data: session, status } = useSession()

  // Get user data from session
  const user = session?.user ? {
    name: session.user.name || "User",
    email: session.user.email || "",
    avatar: session.user.image || null,
  } : null
  
  const isSuperAdmin = session?.user?.isSuperAdmin

  const isLoading = status === "loading"

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {isSuperAdmin && (
               <Collapsible
                  key="Admin"
                  asChild
                  defaultOpen={isMobile ? pathname.startsWith("/admin") : true}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Super Admin">
                        <ShieldCheck className="size-4" />
                        <span className="font-medium">Super Admin</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === "/admin"}>
                              <a href="/admin">
                                <span>Overview</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === "/admin/organizations"}>
                              <a href="/admin/organizations">
                                <span>Organizations</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === "/admin/users"}>
                              <a href="/admin/users">
                                <span>Users</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
            )}

            {data.navMain.map((item) => (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={isMobile ? pathname.startsWith(item.url) : true}
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
                            <a href={subItem.url}>
                              <span>{subItem.title}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {isLoading || !user ? (
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="h-8 w-8 rounded-lg bg-sidebar-accent animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-24 rounded bg-sidebar-accent animate-pulse" />
              <div className="h-3 w-32 rounded bg-sidebar-accent animate-pulse" />
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
