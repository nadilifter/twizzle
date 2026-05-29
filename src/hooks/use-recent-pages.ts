"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "twizzle:command-palette:recent";
const MAX_RECENT = 5;

export interface RecentPage {
  pathname: string;
  label: string;
}

function labelFromPathname(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "Home";
  const last = parts[parts.length - 1];
  // Skip UUIDs / cuid-shaped segments — use the parent segment instead
  if (/^[a-z0-9]{20,}$/i.test(last) && parts.length > 1) {
    const parent = parts[parts.length - 2];
    return parent.charAt(0).toUpperCase() + parent.slice(1).replace(/-/g, " ");
  }
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ");
}

function readRecent(): RecentPage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentPage[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(pathname: string): RecentPage[] {
  const pages = readRecent().filter((p) => p.pathname !== pathname);
  const next = [{ pathname, label: labelFromPathname(pathname) }, ...pages].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function useRecentPages(): RecentPage[] {
  const pathname = usePathname();
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);

  useEffect(() => {
    setRecentPages(pushRecent(pathname));
  }, [pathname]);

  return recentPages;
}
