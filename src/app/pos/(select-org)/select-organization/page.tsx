"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronsUpDown, Building2, Loader2, LogOut, CreditCard } from "lucide-react";
import { useSession } from "next-auth/react";
import { logout } from "@/lib/logout";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShineBorder } from "@/components/ui/shine-border";
import { GradientBackground } from "@/components/ui/gradient-background";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { getUserOrganizations, verifyOrganizationMembership } from "@/app/actions/organization";

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
};

function POSSelectOrganizationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselect = searchParams.get("preselect");

  const { data: session, update } = useSession();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [autoSelectAttempted, setAutoSelectAttempted] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>(undefined);

  // Fetch organizations when session is ready
  React.useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const orgs = await getUserOrganizations();
        setOrganizations(orgs);
      } catch (error) {
        console.error("Failed to fetch organizations", error);
      } finally {
        setFetching(false);
      }
    };

    if (session?.user) {
      fetchOrgs();
    } else if (session === null) {
      setFetching(false);
    }
  }, [session]);

  // Handle auto-selection from preselect param
  React.useEffect(() => {
    const handleAutoSelect = async () => {
      if (autoSelectAttempted || fetching || !preselect || organizations.length === 0) {
        return;
      }

      setAutoSelectAttempted(true);

      // Check if the preselected org is in the user's list
      const preselectOrg = organizations.find((o) => o.id === preselect);

      if (preselectOrg) {
        // Verify membership server-side
        const hasAccess = await verifyOrganizationMembership(preselect);
        if (hasAccess) {
          await handleSelect(preselect);
        }
      }
    };

    handleAutoSelect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect, organizations, fetching, autoSelectAttempted]);

  React.useEffect(() => {
    if (buttonRef.current) {
      setPopoverWidth(buttonRef.current.offsetWidth);
    }
  }, [fetching]);

  const handleSelect = async (orgId: string) => {
    const selectedOrg = organizations.find((o) => o.id === orgId);
    if (!selectedOrg) return;

    setValue(orgId);
    setOpen(false);
    setIsLoading(true);

    // Update session with new organization
    await update({
      organizationId: selectedOrg.id,
      organizationName: selectedOrg.name,
    });

    // Redirect to POS terminal
    router.push("/pos");
    router.refresh();
  };

  const handleSignOut = () => {
    logout("/login");
  };

  if (isLoading || fetching) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">
            {fetching ? "Loading Organizations..." : "Switching Organization"}
          </h1>
          <p className="text-sm text-muted-foreground">Please wait...</p>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden w-full max-w-[400px]">
      <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
      <CardHeader className="items-center pb-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">POS Terminal</h1>
        <p className="text-sm text-muted-foreground">Select an organization to continue</p>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-2 text-left">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={buttonRef}
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
              >
                {value
                  ? organizations.find((org) => org.id === value)?.name
                  : "Select organization..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0"
              align="start"
              style={popoverWidth ? { width: `${popoverWidth}px` } : undefined}
            >
              <Command>
                <CommandInput placeholder="Search organization..." />
                <CommandList>
                  <CommandEmpty>No organization found.</CommandEmpty>
                  <CommandGroup>
                    {organizations.map((organization) => (
                      <CommandItem
                        key={organization.id}
                        value={organization.name}
                        onSelect={() => handleSelect(organization.id)}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        {organization.name}
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            value === organization.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-center text-sm text-muted-foreground">
            You will be taken to the POS terminal after selecting an organization.
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button variant="ghost" onClick={handleSignOut} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function POSSelectOrganizationPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-background relative overflow-hidden">
      <GradientBackground className="z-0" />
      <div className="absolute top-4 right-4 z-50">
        <AnimatedThemeToggler />
      </div>

      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 text-center z-10">
        <React.Suspense
          fallback={
            <Card className="relative overflow-hidden w-full max-w-[400px]">
              <ShineBorder shineColor={["#5655ED", "#A07CFE"]} />
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          }
        >
          <POSSelectOrganizationForm />
        </React.Suspense>
      </main>
    </div>
  );
}
