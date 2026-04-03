"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { ChevronsUpDown, Plus, Check, Building2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserOrganizations } from "@/app/actions/organization";
import { getClientSubdomainUrl } from "@/lib/client-domains";

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  isActive?: boolean;
};

// Module-level cache survives component remounts during client-side navigation
let orgCache: { userId: string; orgs: Organization[] } | null = null;

export function OrganizationSwitcher() {
  const { isMobile } = useSidebar();
  const { data: session, update } = useSession();
  const [open, setOpen] = React.useState(false);
  const [organizations, setOrganizations] = React.useState<Organization[]>(() => {
    const userId = session?.user?.id;
    if (userId && orgCache?.userId === userId) return orgCache.orgs;
    return [];
  });

  React.useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    if (orgCache?.userId === userId) {
      if (organizations.length === 0) setOrganizations(orgCache.orgs);
      return;
    }

    const fetchOrgs = async () => {
      try {
        const orgs = await getUserOrganizations();
        orgCache = { userId, orgs };
        setOrganizations(orgs);
      } catch (error) {
        console.error("Failed to fetch organizations", error);
      }
    };
    fetchOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const activeOrg = React.useMemo(() => {
    if (!session?.user?.organizationId) return organizations[0];
    return organizations.find((o) => o.id === session.user.organizationId) || organizations[0];
  }, [session, organizations]);

  const handleSwitch = async (org: Organization) => {
    await update({
      organizationId: org.id,
      organizationName: org.name,
    });
    // Full page reload to ensure all data is fresh
    window.location.reload();
  };

  // Handle loading state
  if (!session || organizations.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <Skeleton className="size-8 rounded-lg" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!activeOrg) {
    return null; // Or some other fallback
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeOrg.name}</span>
                <span className="truncate text-xs">Organization</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] min-w-56 rounded-lg p-0"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <Command>
              <CommandInput placeholder="Search organizations..." />
              <CommandList>
                <CommandEmpty>No organization found.</CommandEmpty>
                <CommandGroup heading="Organizations">
                  {organizations.map((org) => (
                    <CommandItem
                      key={org.id}
                      value={org.name}
                      onSelect={() => {
                        handleSwitch(org);
                        setOpen(false);
                      }}
                      className={org.isActive === false ? "opacity-50" : ""}
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border">
                        <Building2 className="size-4 shrink-0" />
                      </div>
                      <span className="truncate">
                        {org.name}
                        {org.isActive === false && (
                          <span className="ml-1 text-xs text-destructive">(Deactivated)</span>
                        )}
                      </span>
                      {activeOrg.id === org.id && <Check className="ml-auto size-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      const startupUrl = getClientSubdomainUrl("startup");
                      window.location.href = startupUrl;
                    }}
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                      <Plus className="size-4" />
                    </div>
                    <div className="font-medium text-muted-foreground">Add Organization</div>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
