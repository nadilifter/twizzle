"use client";

import { LogOutIcon, ShieldAlertIcon, ShieldIcon, UserIcon, UsersIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getLogoutUrl } from "@/lib/logout";
import { getClientSubdomainUrl } from "@/lib/client-domains";

interface MarketingUserMenuProps {
  user: { name: string; email: string; image?: string | null };
  isAdmin: boolean;
  isSuperAdmin: boolean;
  siteUrl: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MarketingUserMenu({
  user,
  isAdmin,
  isSuperAdmin,
  siteUrl,
}: MarketingUserMenuProps) {
  const handleLogout = () => {
    const logoutUrl = `${getLogoutUrl()}?redirectUrl=${encodeURIComponent(siteUrl)}`;
    window.location.href = logoutUrl;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
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
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={`${getClientSubdomainUrl("athletes")}/account`}>
            <UserIcon />
            Account
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={getClientSubdomainUrl("athletes")}>
            <UsersIcon />
            Athletes
          </a>
        </DropdownMenuItem>
        {isAdmin && (
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
