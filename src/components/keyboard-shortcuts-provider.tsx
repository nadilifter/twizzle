"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";

// ─── Subdomain routing (mirrors command-palette.tsx) ─────────────────────────

function portalSubdomainForPath(url: string): string | null {
  if (url.startsWith("/dashboard")) return "admin";
  if (url.startsWith("/coach")) return "coach";
  if (url.startsWith("/superadmin")) return "superadmin";
  return null;
}

function extractCurrentSubdomain(hostname: string): string | null {
  if (!hostname) return null;
  const parts = hostname.split(".");
  if (parts.length < 3) return null;
  return parts[0];
}

function buildSubdomainUrl(subdomain: string, path: string): string | null {
  if (typeof window === "undefined") return null;
  const { hostname, port, protocol } = window.location;
  const parts = hostname.split(".");
  const baseParts = parts.length >= 3 ? parts.slice(1) : parts;
  const baseHost = baseParts.join(".");
  const portSuffix = port ? `:${port}` : "";
  const hostWithPort = hostname.includes(":") ? "" : portSuffix;
  return `${protocol}//${subdomain}.${baseHost}${hostWithPort}${path}`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface KeyboardShortcutsContextValue {
  openHelp: () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue>({
  openHelp: () => {},
});

export function useKeyboardShortcuts(): KeyboardShortcutsContextValue {
  return useContext(KeyboardShortcutsContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  const role = session?.user?.role ?? "";
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false;
  const isAdmin = role === "ADMIN" || isSuperAdmin;

  const navigate = useCallback(
    (url: string) => {
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
    [router]
  );

  const openHelp = useCallback(() => setHelpOpen(true), []);

  useGlobalShortcuts({ onHelpOpen: openHelp, onNavigate: navigate, isAdmin });

  return (
    <KeyboardShortcutsContext.Provider value={{ openHelp }}>
      {children}
      <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} isAdmin={isAdmin} />
    </KeyboardShortcutsContext.Provider>
  );
}

// ─── Help dialog ─────────────────────────────────────────────────────────────

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium leading-none text-foreground">
      {label}
    </kbd>
  );
}

function ShortcutRow({
  keys,
  then,
  description,
}: {
  keys: string[];
  then?: boolean;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{description}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <React.Fragment key={k + i}>
            {then && i > 0 && <span className="text-[10px] text-muted-foreground/60">then</span>}
            <Key label={k} />
          </React.Fragment>
        ))}
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

function ShortcutsHelpDialog({
  open,
  onOpenChange,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>Tip: press ? on any page to open this dialog.</DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-4 text-sm">
          <div>
            <SectionHeading>Navigate</SectionHeading>
            <div className="divide-y divide-border/60">
              <ShortcutRow keys={["g", "a"]} then description="Go to athletes" />
              <ShortcutRow keys={["g", "p"]} then description="Go to programs" />
              {isAdmin && <ShortcutRow keys={["g", "c"]} then description="Go to competitions" />}
              <ShortcutRow keys={["g", "s"]} then description="Go to settings" />
            </div>
          </div>

          <div>
            <SectionHeading>List page</SectionHeading>
            <div className="divide-y divide-border/60">
              <ShortcutRow keys={["j"]} description="Move selection down" />
              <ShortcutRow keys={["k"]} description="Move selection up" />
              <ShortcutRow keys={["↵"]} description="Open selected row" />
              <ShortcutRow keys={["e"]} description="Edit selected row" />
              <ShortcutRow keys={["d"]} description="Delete selected row" />
            </div>
          </div>

          <div>
            <SectionHeading>Misc</SectionHeading>
            <div className="divide-y divide-border/60">
              <ShortcutRow keys={["?"]} description="Open this dialog" />
              <ShortcutRow keys={["⌘K"]} description="Open command palette" />
              <ShortcutRow keys={["Esc"]} description="Close dialog / sheet" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
