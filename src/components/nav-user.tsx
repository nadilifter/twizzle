"use client"

import { LogOutIcon, MoreVerticalIcon, ShieldAlertIcon, ShieldIcon, UserIcon } from "lucide-react"
import { useSession } from "next-auth/react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { logout } from "@/lib/logout"
import { getClientSubdomainUrl } from "@/lib/client-domains"

export function NavUser({
  user,
  accountUrl,
}: {
  user: {
    name: string
    email: string
    avatar?: string | null
  }
  accountUrl?: string
}) {
  const { isMobile } = useSidebar()
  const { data: session } = useSession()

  const isSuperAdmin = session?.user?.isSuperAdmin === true
  const showAdminLink =
    isSuperAdmin || session?.user?.permissions?.includes("*") === true
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleSignOut = () => {
    logout("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <MoreVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accountUrl && (
              <DropdownMenuItem asChild>
                <a href={`${getClientSubdomainUrl("athletes")}/account`}>
                  <UserIcon />
                  Account
                </a>
              </DropdownMenuItem>
            )}
            {showAdminLink && (
              <DropdownMenuItem asChild>
                <a href={getClientSubdomainUrl("admin")}>
                  <ShieldIcon />
                  Admin
                </a>
              </DropdownMenuItem>
            )}
            {isSuperAdmin && (
              <DropdownMenuItem asChild>
                <a href={getClientSubdomainUrl("superadmin")}>
                  <ShieldAlertIcon />
                  Superadmin
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
