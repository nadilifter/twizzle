"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { 
  Building2, 
  CreditCard,
  Globe, 
  LayoutDashboard, 
  Package,
  ShieldCheck, 
  Users,
  ExternalLink,
  UserPlus,
  ShoppingCart,
  Calendar,
  LogIn,
  Home,
  Megaphone,
  MessageSquare
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

// Quick link items for external pages
const quickLinkItems = [
  { title: "Landing Page", url: "/", icon: Home },
  { title: "Login", url: "/login", icon: LogIn },
  { title: "Signup", url: "/signup", icon: UserPlus },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "POS Terminal", url: "/pos", icon: ShoppingCart },
  { title: "Coach Portal", url: "/coach", icon: Users },
  { title: "Athletes Portal", url: "/athletes", icon: Users },
  { title: "Events Portal", url: "/events", icon: Calendar },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Feedback", url: "/feedback", icon: MessageSquare },
]

// Signup link component to handle SSR
function SignupLink() {
  const [signupUrl, setSignupUrl] = React.useState("https://signup.uplifterinc.com")
  
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname.includes("localhost")) {
      setSignupUrl("http://signup.uplifterinc.localhost:3000")
    }
  }, [])

  return (
    <SidebarMenuButton asChild>
      <a 
        href={signupUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          <span>Org Signup (Subdomain)</span>
        </span>
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </a>
    </SidebarMenuButton>
  )
}

// Superadmin navigation data
const navItems = [
  {
    title: "Overview",
    url: "/superadmin",
    icon: LayoutDashboard,
  },
  {
    title: "Organizations",
    url: "/superadmin/organizations",
    icon: Building2,
  },
  {
    title: "Users",
    url: "/superadmin/users",
    icon: Users,
  },
  {
    title: "Billing",
    url: "/superadmin/billing",
    icon: CreditCard,
  },
  {
    title: "Plans",
    url: "/superadmin/plans",
    icon: Package,
  },
  {
    title: "Domains",
    url: "/superadmin/domains",
    icon: Globe,
  },
]

export function SuperadminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { data: session, status } = useSession()

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
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Uplifter</span>
            <span className="text-xs text-muted-foreground">Super Admin</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.url === "/superadmin" 
                  ? pathname === "/superadmin"
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
        <SidebarGroup>
          <SidebarGroupLabel>Quick Links</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {quickLinkItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SignupLink />
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
