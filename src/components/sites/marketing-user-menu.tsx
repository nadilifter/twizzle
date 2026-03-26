"use client"

import { LayoutDashboardIcon, LogOutIcon, UserIcon, UsersIcon } from "lucide-react"

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
import { Button } from "@/components/ui/button"
import { getLogoutUrl } from "@/lib/logout"

interface MarketingUserMenuProps {
  user: { name: string; email: string; image?: string | null }
  isAdmin: boolean
  adminUrl: string
  athleteUrl: string
  siteUrl: string
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function MarketingUserMenu({
  user,
  isAdmin,
  adminUrl,
  athleteUrl,
  siteUrl,
}: MarketingUserMenuProps) {
  const handleLogout = () => {
    // Redirect back to this marketing site's home page after logout
    const logoutUrl = `${getLogoutUrl()}?redirectUrl=${encodeURIComponent(siteUrl)}`
    window.location.href = logoutUrl
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 rounded-full"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || undefined} alt={user.name} />
            <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image || undefined} alt={user.name} />
              <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
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
        {isAdmin && (
          <DropdownMenuItem asChild>
            <a href={adminUrl}>
              <LayoutDashboardIcon />
              Admin Dashboard
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href={athleteUrl}>
            <UsersIcon />
            Athletes
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
