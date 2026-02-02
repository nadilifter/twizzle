"use client"

import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnnouncementsTray } from "./announcements-tray"
import { useState } from "react"

interface AnnouncementBellProps extends React.ComponentPropsWithoutRef<"button"> {
  unreadCount?: number
}

export function AnnouncementBell({
  className,
  unreadCount = 0,
  ...props
}: AnnouncementBellProps) {
  const [open, setOpen] = useState(false)

  return (
    <AnnouncementsTray open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground",
          className
        )}
        {...props}
      >
        <Bell className="h-[1.2rem] w-[1.2rem]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <span className="sr-only">View announcements</span>
      </button>
    </AnnouncementsTray>
  )
}
