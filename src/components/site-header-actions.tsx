"use client"

import { useEffect, useState } from "react"
import { AnnouncementBell } from "@/components/announcement-bell"

export function SiteHeaderActions() {
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch("/api/notifications")
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error)
    }
  }

  useEffect(() => {
    fetchUnreadCount()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <AnnouncementBell unreadCount={unreadCount} onClose={fetchUnreadCount} />
}
