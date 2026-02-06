"use client"

import { useEffect, useState } from "react"
import { AnnouncementBellMarketing } from "@/components/announcement-bell-marketing"

interface MarketingAnnouncementBellProps {
  organizationId: string
}

export function MarketingAnnouncementBell({ organizationId }: MarketingAnnouncementBellProps) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const params = new URLSearchParams()
        if (organizationId) {
          params.set("organizationId", organizationId)
        }
        const response = await fetch(`/api/notifications?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setUnreadCount(data.unreadCount || 0)
        }
      } catch (error) {
        console.error("Failed to fetch unread count:", error)
      }
    }

    fetchUnreadCount()
  }, [organizationId])

  return (
    <AnnouncementBellMarketing
      organizationId={organizationId}
      unreadCount={unreadCount}
    />
  )
}
