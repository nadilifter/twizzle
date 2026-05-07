"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnnouncementCard, type AnnouncementItem } from "./announcement-card";
import { CheckCheck, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AnnouncementsTrayProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
}

export function AnnouncementsTray({
  children,
  open,
  onOpenChange,
  organizationId,
}: AnnouncementsTrayProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (organizationId) {
        params.set("organizationId", organizationId);
      }
      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.announcements || []);
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (open) {
      fetchAnnouncements();
    }
  }, [open, fetchAnnouncements]);

  const handleMarkAsRead = async (id: string, type: "system" | "org") => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcementId: id, type, organizationId }),
      });
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      setAnnouncements((prev) => prev.map((a) => ({ ...a, isRead: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const unreadCount = announcements.filter((a) => !a.isRead).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children}
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle>Announcements</SheetTitle>
            {loading ? (
              <Skeleton className="h-7 w-24 rounded-md" />
            ) : unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={markingAllRead}
                className="text-xs"
              >
                {markingAllRead ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <CheckCheck className="mr-1 h-3 w-3" />
                )}
                Mark all read
              </Button>
            ) : null}
          </div>
          {loading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            <SheetDescription>
              {unreadCount > 0
                ? `You have ${unreadCount} unread announcement${unreadCount !== 1 ? "s" : ""}`
                : "You're all caught up!"}
            </SheetDescription>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No announcements yet</p>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {announcements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
