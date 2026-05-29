"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { type RecentPage, useRecentPages } from "@/hooks/use-recent-pages";

// ─── Context ──────────────────────────────────────────────────────────────────

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: () => {},
});

export function useCommandPalette(): CommandPaletteContextValue {
  return useContext(CommandPaletteContext);
}

// ─── Subdomain routing ────────────────────────────────────────────────────────
//
// The product is split across subdomains: admin (/dashboard), coach (/coach),
// superadmin (/superadmin). router.push() is same-origin only, so navigations
// that change portals have to go through window.location with a full URL.

/**
 * Map a path to the subdomain that serves it. Returns null when the path is
 * not portal-specific (e.g. /login, /sites/...) — caller should fall through
 * to client-side router.push().
 */
function portalSubdomainForPath(url: string): string | null {
  if (url.startsWith("/dashboard")) return "admin";
  if (url.startsWith("/coach")) return "coach";
  if (url.startsWith("/superadmin")) return "superadmin";
  return null;
}

/**
 * Extract the current subdomain from `window.location.hostname`. Returns
 * null when on the apex (no subdomain).
 */
function extractCurrentSubdomain(hostname: string): string | null {
  if (!hostname) return null;
  const parts = hostname.split(".");
  // Local: <sub>.uplifter.localhost  → first part is the subdomain
  // Prod: <sub>.uplifter.app         → same
  // Apex: uplifter.localhost / uplifter.app → no subdomain
  if (parts.length < 3) return null;
  return parts[0];
}

/**
 * Build an absolute URL on a different subdomain, preserving the current
 * protocol + port. Returns null when called server-side.
 */
function buildSubdomainUrl(subdomain: string, path: string): string | null {
  if (typeof window === "undefined") return null;
  const { hostname, port, protocol } = window.location;
  const parts = hostname.split(".");
  // Drop the current subdomain (first part) to get the base domain.
  const baseParts = parts.length >= 3 ? parts.slice(1) : parts;
  const baseHost = baseParts.join(".");
  const portSuffix = port ? `:${port}` : "";
  // hostname already includes the port on uplifter.localhost — guard against
  // doubling it up.
  const hostWithPort = hostname.includes(":") ? "" : portSuffix;
  return `${protocol}//${subdomain}.${baseHost}${hostWithPort}${path}`;
}

// ─── Nav items ────────────────────────────────────────────────────────────────

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const ADMIN_NAV: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
  { title: "Athletes", url: "/dashboard/athletes", icon: Users },
  { title: "Attendance", url: "/dashboard/athletes/attendance", icon: ClipboardCheck },
  { title: "Guardians", url: "/dashboard/athletes/guardians", icon: Users },
  { title: "Programs", url: "/dashboard/registrations/programs", icon: GraduationCap },
  { title: "Seasons", url: "/dashboard/registrations/seasons", icon: CalendarDays },
  { title: "Competitions", url: "/dashboard/competitions", icon: CalendarCheck },
  { title: "Skills", url: "/dashboard/training/skills", icon: Star },
  { title: "Evaluations", url: "/dashboard/training/evaluations", icon: Star },
  { title: "Announcements", url: "/dashboard/communication/announcements", icon: MessageSquare },
  { title: "Financials", url: "/dashboard/financials", icon: DollarSign },
  { title: "Reports", url: "/dashboard/reports", icon: FileText },
  { title: "Organization", url: "/dashboard/organization/overview", icon: Building2 },
  { title: "Staff", url: "/dashboard/organization/staff", icon: Users },
  { title: "Settings", url: "/dashboard/organization/features", icon: Settings },
];

const COACH_NAV: NavItem[] = [
  { title: "Coach Overview", url: "/coach", icon: LayoutDashboard },
  { title: "Coach Athletes", url: "/coach/athletes", icon: Users },
  { title: "Coach Programs", url: "/coach/programs", icon: GraduationCap },
  { title: "Coach Attendance", url: "/coach/attendance", icon: ClipboardCheck },
  { title: "Coach Evaluations", url: "/coach/evaluations", icon: Star },
  { title: "Coach Schedule", url: "/coach/schedule", icon: CalendarDays },
  { title: "Coach Chat", url: "/coach/chat", icon: MessageSquare },
];

// ─── Search results ───────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  name: string;
}

interface SearchState {
  athletes: SearchResult[];
  programs: SearchResult[];
  isLoading: boolean;
}

const EMPTY_SEARCH: SearchState = { athletes: [], programs: [], isLoading: false };

// ─── Inner tracker (must be inside the provider so usePathname works) ────────

function RecentPageTracker() {
  // Side-effect only: pushes the current page into localStorage on each navigation.
  useRecentPages();
  return null;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open }}>
      {children}
      <RecentPageTracker />
      <CommandPaletteDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </CommandPaletteContext.Provider>
  );
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

function CommandPaletteDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read recent pages from localStorage each time the palette opens
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = localStorage.getItem("twizzle:command-palette:recent");
      setRecentPages(raw ? (JSON.parse(raw) as RecentPage[]) : []);
    } catch {
      setRecentPages([]);
    }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSearch(EMPTY_SEARCH);
    }
  }, [isOpen]);

  // Debounced search (250 ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isOpen || query.length < 3) {
      setSearch((s) => (s.isLoading ? EMPTY_SEARCH : s));
      return;
    }

    setSearch((s) => ({ ...s, isLoading: true }));

    debounceRef.current = setTimeout(async () => {
      try {
        const q = encodeURIComponent(query);
        const [athleteRes, programRes] = await Promise.all([
          fetch(`/api/athletes?search=${q}&limit=8`).then((r) =>
            r.ok
              ? (r.json() as Promise<{
                  data: Array<{ id: string; firstName: string; lastName: string }>;
                }>)
              : { data: [] }
          ),
          // TODO: /api/programs supports ?search= — wire once endpoint is confirmed stable
          fetch(`/api/programs?search=${q}&limit=8`).then((r) =>
            r.ok
              ? (r.json() as Promise<{ data: Array<{ id: string; name: string }> }>)
              : { data: [] }
          ),
        ]);

        setSearch({
          athletes: (athleteRes.data ?? []).map((a) => ({
            id: a.id,
            name: `${a.firstName} ${a.lastName}`.trim(),
          })),
          programs: (programRes.data ?? []).map((p) => ({
            id: p.id,
            name: p.name,
          })),
          isLoading: false,
        });
      } catch {
        setSearch(EMPTY_SEARCH);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen]);

  // Role / permission helpers
  const role = session?.user?.role ?? "";
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false;
  const isAdmin = role === "ADMIN" || isSuperAdmin;
  const isCoach =
    role === "COACH" || (session?.user?.permissions?.includes("coaching.portal") ?? false);
  const canViewAthletes =
    isAdmin || (session?.user?.permissions?.includes("athletes.view") ?? false);

  const navigate = useCallback(
    (url: string) => {
      onClose();
      // Cross-subdomain routing: /dashboard lives on admin., /coach on coach.,
      // /superadmin on superadmin. router.push() is same-origin only, so when
      // the target portal differs from the current host we have to do a full
      // navigation. Otherwise we'd hit 404 on the wrong subdomain.
      const targetSubdomain = portalSubdomainForPath(url);
      const currentSubdomain =
        typeof window !== "undefined" ? extractCurrentSubdomain(window.location.hostname) : null;
      if (targetSubdomain && targetSubdomain !== currentSubdomain) {
        const absolute = buildSubdomainUrl(targetSubdomain, url);
        if (absolute) {
          window.location.assign(absolute);
          return;
        }
      }
      router.push(url);
    },
    [onClose, router]
  );

  const athleteBase = isAdmin ? "/dashboard/athletes" : "/coach/athletes";
  const programBase = isAdmin ? "/dashboard/registrations/programs" : "/coach/programs";

  const visibleNav = [...(isAdmin ? ADMIN_NAV : []), ...(isCoach ? COACH_NAV : [])];

  const showAthletes = canViewAthletes && search.athletes.length > 0;
  const showPrograms = search.programs.length > 0;
  const showRecent = !query && recentPages.length > 0;

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <CommandInput
        placeholder="Type a command or search…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{search.isLoading ? "Searching…" : "No results found."}</CommandEmpty>

        {/* Recent */}
        {showRecent && (
          <>
            <CommandGroup heading="Recent">
              {recentPages.map((page) => (
                <CommandItem
                  key={page.pathname}
                  value={`recent ${page.label} ${page.pathname}`}
                  onSelect={() => navigate(page.pathname)}
                >
                  <Clock className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                  <span className="flex-1">{page.label}</span>
                  <CommandShortcut>{page.pathname}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            {visibleNav.length > 0 && <CommandSeparator />}
          </>
        )}

        {/* Navigate */}
        {visibleNav.length > 0 && (
          <>
            <CommandGroup heading="Navigate">
              {visibleNav.map((item) => (
                <CommandItem
                  key={item.url}
                  value={`navigate ${item.title} ${item.url}`}
                  onSelect={() => navigate(item.url)}
                >
                  <item.icon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.title}</span>
                  <CommandShortcut>{item.url}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Athletes search */}
        {showAthletes && (
          <>
            <CommandGroup heading={search.isLoading ? "Athletes…" : "Athletes"}>
              {search.athletes.map((athlete) => (
                <CommandItem
                  key={athlete.id}
                  value={`athlete ${athlete.name}`}
                  onSelect={() => navigate(`${athleteBase}/${athlete.id}`)}
                >
                  <Users className="mr-2 h-4 w-4 shrink-0" />
                  {athlete.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Programs search */}
        {showPrograms && (
          <>
            <CommandGroup heading="Programs">
              {search.programs.map((program) => (
                <CommandItem
                  key={program.id}
                  value={`program ${program.name}`}
                  onSelect={() => navigate(`${programBase}/${program.id}`)}
                >
                  <GraduationCap className="mr-2 h-4 w-4 shrink-0" />
                  {program.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Actions */}
        <CommandGroup heading="Actions">
          {isAdmin && (
            <>
              <CommandItem
                value="action new athlete"
                onSelect={() => navigate("/dashboard/athletes")}
              >
                <Plus className="mr-2 h-4 w-4 shrink-0" />
                New athlete
              </CommandItem>
              <CommandItem
                value="action new program"
                onSelect={() => navigate("/dashboard/registrations/programs/new")}
              >
                <Plus className="mr-2 h-4 w-4 shrink-0" />
                New program
              </CommandItem>
              <CommandItem
                value="action new evaluation"
                onSelect={() => navigate("/dashboard/training/evaluations")}
              >
                <Plus className="mr-2 h-4 w-4 shrink-0" />
                New evaluation
              </CommandItem>
            </>
          )}
          <CommandItem
            value="action switch organization"
            onSelect={() => navigate("/switch-organization")}
          >
            <Building2 className="mr-2 h-4 w-4 shrink-0" />
            Switch organization
          </CommandItem>
          <CommandItem
            value="action log out sign out"
            onSelect={() => {
              onClose();
              void signOut({ callbackUrl: "/login" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
            Log out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
