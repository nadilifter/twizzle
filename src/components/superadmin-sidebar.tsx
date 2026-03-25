"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { 
  Bell,
  Building2, 
  CreditCard,
  DollarSign,
  Globe, 
  Layers,
  LayoutDashboard, 
  Package,
  ShieldCheck, 
  Timer,
  Trophy,
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

// Helper to construct subdomain URLs based on current hostname
function getSubdomainUrl(subdomain: string | null): string {
  if (typeof window === 'undefined') return '/'
  
  const { hostname, port, protocol } = window.location
  
  // Parse current hostname to extract base domain
  const parts = hostname.split('.')
  
  // Handle local development (e.g., superadmin.uplifterinc.localhost:3000)
  if (hostname.includes('localhost')) {
    // Find the base domain pattern (e.g., uplifterinc.localhost)
    const localhostIndex = parts.findIndex(p => p.includes('localhost'))
    if (localhostIndex > 0) {
      // Has subdomain structure like subdomain.uplifterinc.localhost
      const baseParts = parts.slice(1) // Remove current subdomain
      if (subdomain) {
        return `${protocol}//${subdomain}.${baseParts.join('.')}${port && !hostname.includes(':') ? ':' + port : ''}`
      } else {
        // Main domain (no subdomain)
        return `${protocol}//${baseParts.join('.')}${port && !hostname.includes(':') ? ':' + port : ''}`
      }
    }
    // Fallback for plain localhost
    return subdomain ? `${protocol}//${subdomain}.localhost:3000` : `${protocol}//localhost:3000`
  }
  
  // Handle production/staging domains (e.g., superadmin.uplifterinc.com)
  if (parts.length >= 2) {
    const baseParts = parts.slice(1) // Remove current subdomain
    if (subdomain) {
      return `${protocol}//${subdomain}.${baseParts.join('.')}`
    } else {
      // Main domain (no subdomain)
      return `${protocol}//${baseParts.join('.')}`
    }
  }
  
  return '/'
}

// Quick link configuration with subdomain info
// subdomain: null = main domain, string = specific subdomain
const quickLinkConfig = [
  { title: "Landing Page", subdomain: null, path: "/", icon: Home },
  { title: "Login", subdomain: "login", path: "/", icon: LogIn },
  { title: "Dashboard", subdomain: "admin", path: "/", icon: LayoutDashboard },
  { title: "POS Terminal", subdomain: "pos", path: "/", icon: ShoppingCart },
  { title: "Coach Portal", subdomain: "coach", path: "/", icon: Users },
  { title: "Athletes Portal", subdomain: "athletes", path: "/", icon: Users },
  { title: "Events Portal", subdomain: "events", path: "/", icon: Calendar },
  { title: "Feedback", subdomain: "feedback", path: "/", icon: MessageSquare },
]

// Org Signup link: startup subdomain (not superadmin)
function OrgSignupLink({ getUrl }: { getUrl: (subdomain: string | null) => string }) {
  const url = getUrl("startup")

  return (
    <SidebarMenuButton asChild>
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          <span>Org Signup</span>
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
    title: "Trials",
    url: "/superadmin/trials",
    icon: Timer,
  },
  {
    title: "Users",
    url: "/superadmin/users",
    icon: Users,
  },
  {
    title: "Customer Transactions",
    url: "/superadmin/billing",
    icon: CreditCard,
  },
  {
    title: "Subscription Billing",
    url: "/superadmin/subscription-billing",
    icon: CreditCard,
  },
  {
    title: "Revenue",
    url: "/superadmin/revenue",
    icon: DollarSign,
  },
  {
    title: "Plans",
    url: "/superadmin/plans",
    icon: Package,
  },
  {
    title: "Sports",
    url: "/superadmin/sports",
    icon: Trophy,
  },
  {
    title: "Competitions",
    url: "/superadmin/competitions",
    icon: Trophy,
  },
  {
    title: "Competition Categories",
    url: "/superadmin/competition-categories",
    icon: Layers,
  },
  {
    title: "Domains",
    url: "/superadmin/domains",
    icon: Globe,
  },
  {
    title: "Announcements",
    url: "/superadmin/announcements",
    icon: Bell,
  },
  {
    title: "Feedback",
    url: "/superadmin/feedback",
    icon: MessageSquare,
  },
]

export function SuperadminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [quickLinks, setQuickLinks] = React.useState<Array<{ title: string; url: string; icon: typeof Home }>>([])

  // Build quick links with proper subdomain URLs on client side
  React.useEffect(() => {
    const links = quickLinkConfig.map(item => ({
      title: item.title,
      url: getSubdomainUrl(item.subdomain) + (item.path === "/" ? "" : item.path),
      icon: item.icon,
    }))
    setQuickLinks(links)
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
              {quickLinks.map((item) => (
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
                <OrgSignupLink getUrl={getSubdomainUrl} />
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
          <NavUser user={user} accountUrl="/athletes/account" />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
