"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  Eye,
  LayoutDashboard,
  MessageSquare,
  UserCheck,
  Star,
  Camera,
  CalendarDays,
  GraduationCap,
} from "lucide-react";
import { useSession } from "next-auth/react";

import { NavUser } from "@/components/nav-user";
import { useFeatures } from "@/components/feature-context";
import type { FeatureKey } from "@/lib/feature-toggles";
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
} from "@/components/ui/sidebar";

const CHAT_UNREAD_CACHE_MS = 60_000;
let chatUnreadCache: { count: number; fetchedAt: number } | null = null;

function CoachChatUnreadBadge() {
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
    fetch("/api/coach/chat/unread-count")
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

// Coach navigation data
const navItems: {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredFeature?: FeatureKey;
}[] = [
  {
    title: "Overview",
    url: "/coach",
    icon: LayoutDashboard,
  },
  {
    title: "Chat",
    url: "/coach/chat",
    icon: MessageSquare,
  },
  {
    title: "Programs",
    url: "/coach/programs",
    icon: GraduationCap,
  },
  {
    title: "Attendance",
    url: "/coach/attendance",
    icon: ClipboardCheck,
  },
  {
    title: "Evaluations",
    url: "/coach/evaluations",
    icon: Star,
    requiredFeature: "training",
  },
  {
    title: "Schedule",
    url: "/coach/schedule",
    icon: CalendarDays,
  },
  {
    title: "Media",
    url: "/coach/media",
    icon: Camera,
  },
];

const superadminItems = [
  {
    title: "View as User",
    url: "/coach/admin/view-as-user",
    icon: Eye,
  },
];

export function CoachSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { isFeatureEnabled } = useFeatures();

  const isSuperAdmin = session?.user?.isSuperAdmin === true;

  const filteredNavItems = navItems.filter(
    (item) => !item.requiredFeature || isFeatureEnabled(item.requiredFeature)
  );

  // Get user data from session
  const user = session?.user
    ? {
        name: session.user.name || "User",
        email: session.user.email || "",
        avatar: session.user.image || null,
      }
    : null;

  const isLoading = status === "loading";

  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Coach Portal</span>
            <span className="text-xs text-muted-foreground">Uplifter</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => {
                const isActive =
                  item.url === "/coach" ? pathname === "/coach" : pathname.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <a href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                    {item.url === "/coach/chat" && <CoachChatUnreadBadge />}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Admin Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superadminItems.map((item) => {
                  const isActive = pathname.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <a href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
  );
}
