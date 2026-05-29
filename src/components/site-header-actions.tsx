"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AnnouncementBell } from "@/components/announcement-bell";
import { useCommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";

function SearchButton() {
  const { open } = useCommandPalette();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  return (
    <Button
      variant="outline"
      size="sm"
      className="hidden h-8 gap-1.5 rounded-md px-3 text-xs text-muted-foreground sm:flex"
      onClick={open}
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search</span>
      <kbd className="pointer-events-none ml-1 inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        {isMac ? <span className="text-[9px]">⌘</span> : "Ctrl+"}K
      </kbd>
    </Button>
  );
}

export function SiteHeaderActions() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch("/api/notifications");
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <SearchButton />
      <AnnouncementBell unreadCount={unreadCount} onClose={fetchUnreadCount} />
    </>
  );
}
