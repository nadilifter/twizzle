"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnnouncementsTray } from "./announcements-tray";
import { useState } from "react";

interface AnnouncementBellMarketingProps {
  organizationId?: string;
  unreadCount?: number;
  onClose?: () => void;
}

export function AnnouncementBellMarketing({
  organizationId,
  unreadCount = 0,
  onClose,
}: AnnouncementBellMarketingProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = React.useState(false);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) onClose?.();
  };

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8 md:size-9">
        <Bell className="size-4 md:size-5" />
      </Button>
    );
  }

  return (
    <AnnouncementsTray open={open} onOpenChange={handleOpenChange} organizationId={organizationId}>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 md:size-9 relative"
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4 md:size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <span className="sr-only">View announcements</span>
      </Button>
    </AnnouncementsTray>
  );
}
