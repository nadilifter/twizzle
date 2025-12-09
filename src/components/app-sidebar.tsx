"use client"

import * as React from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ChevronRight, LifeBuoy, Send } from "lucide-react"

import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
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
  SidebarGroupLabel,
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

// This is sample data.
const data = {
  user: {
    name: "Andrew Karzel",
    email: "andrewkarzel@uplifterinc.com",
    avatar: "/avatars/shadcn.jpg",
  },
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
          title: "Invoices",
          url: "/dashboard/financials/invoices",
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
          title: "Transactions",
          url: "/dashboard/financials/transactions",
        },
        {
          title: "Integrations",
          url: "/dashboard/financials/integrations",
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

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Image 
                    src="/favicon.ico" 
                    alt="Uplifter Logo" 
                    width={24} 
                    height={24} 
                    className="size-5"
                  />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Uplifter</span>
                  <span className="">v0.0.1</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
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
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

