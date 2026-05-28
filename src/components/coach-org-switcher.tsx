"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { getUserOrganizations } from "@/app/actions/organization";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Org {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  isActive: boolean;
}

/**
 * Shows the active organization in the coach sidebar header. If the coach
 * is a member of more than one org, the name becomes a dropdown that lets
 * them switch — sidebar items (e.g., Evaluations, gated by `training`)
 * re-evaluate against the new org's plan automatically once the session
 * is refreshed.
 */
export function CoachOrgSwitcher() {
  const { data: session, update, status } = useSession();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    getUserOrganizations()
      .then((data) => {
        if (!cancelled) setOrgs(data);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const currentOrgId = session?.user?.organizationId ?? null;
  const currentOrg = (orgs ?? []).find((o) => o.id === currentOrgId);
  const currentName = currentOrg?.name ?? session?.user?.organizationName ?? "Uplifter";

  // Loading state — render the name unobtrusively so the layout doesn't shift
  if (orgs === null) {
    return <span className="text-xs text-muted-foreground truncate">{currentName}</span>;
  }

  // Single-org coach: no switcher, just a label
  if (orgs.length <= 1) {
    return <span className="text-xs text-muted-foreground truncate">{currentName}</span>;
  }

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrgId || switching) return;
    setSwitching(true);
    try {
      await update({ organizationId: orgId });
      router.refresh();
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "text-xs text-muted-foreground hover:text-foreground",
          "flex items-center gap-1 truncate -ml-1 px-1 py-0.5 rounded hover:bg-sidebar-accent"
        )}
        aria-label="Switch organization"
      >
        {switching ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{currentName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Switch organization
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => handleSwitch(org.id)}
            disabled={switching}
            className="flex items-center gap-2"
          >
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === currentOrgId && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
