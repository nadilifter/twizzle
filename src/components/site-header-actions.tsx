"use client"

import { useEffect, useState } from "react"
import { AnnouncementBell } from "@/components/announcement-bell"

export function SiteHeaderActions() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Fetch unread count on mount
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

    fetchUnreadCount()

    // Refresh every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  return <AnnouncementBell unreadCount={unreadCount} />
}
