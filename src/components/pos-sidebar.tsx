"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { 
  ShoppingCart,
  CreditCard,
  LayoutDashboard,
  ArrowLeft,
} from "lucide-react"
import { useSession } from "next-auth/react"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

// Helper to construct subdomain URLs
function getAdminUrl(): string {
  if (typeof window === 'undefined') return '/dashboard'
  
  const { hostname, port, protocol } = window.location
  
  const parts = hostname.split('.')
  if (parts.length >= 3) {
    parts[0] = 'admin'
    const newHostname = parts.join('.')
    return `${protocol}//${newHostname}${port ? ':' + port : ''}`
  }
  
  return '/dashboard'
}

// POS navigation data
const navItems = [
  {
    title: "Terminal",
    url: "/pos",
    icon: ShoppingCart,
  },
]

export function POSSidebar({ 
  organizationName,
  ...props 
}: React.ComponentProps<typeof Sidebar> & { organizationName?: string }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [adminUrl, setAdminUrl] = React.useState('/dashboard')

  React.useEffect(() => {
    setAdminUrl(getAdminUrl())
  }, [])

  // Get user data from session
  const user = session?.user ? {
    name: session.user.name || "User",
    email: session.user.email || "",
    avatar: session.user.image || null,
  } : null

  const isLoading = status === "loading"

  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">POS Terminal</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">BETA</Badge>
            </div>
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              {organizationName || "Uplifter"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.url === "/pos" 
                  ? pathname === "/pos"
                  : pathname.startsWith(item.url)
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <a href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Quick Links</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href={adminUrl}>
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Admin</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
          <NavUser user={user} showOrganizationOptions={false} />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
