"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp, Globe, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { sanitizeHtml } from "@/lib/sanitize"

export interface AnnouncementItem {
  id: string
  title: string
  content: string
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  type: "system" | "org"
  isRead: boolean
  publishedAt: string
  organizationName?: string
}

interface AnnouncementCardProps {
  announcement: AnnouncementItem
  onMarkAsRead?: (id: string, type: "system" | "org") => void
}

const priorityConfig = {
  LOW: {
    variant: "secondary" as const,
    label: "Low",
    className: "bg-muted text-muted-foreground",
  },
  NORMAL: {
    variant: "secondary" as const,
    label: "Normal",
    className: "",
  },
  HIGH: {
    variant: "default" as const,
    label: "High",
    className: "bg-orange-500 text-white hover:bg-orange-600",
  },
  URGENT: {
    variant: "destructive" as const,
    label: "Urgent",
    className: "",
  },
}

export function AnnouncementCard({
  announcement,
  onMarkAsRead,
}: AnnouncementCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const priority = priorityConfig[announcement.priority]

  const handleOpen = (open: boolean) => {
    setIsOpen(open)
    if (open && !announcement.isRead && onMarkAsRead) {
      onMarkAsRead(announcement.id, announcement.type)
    }
  }

  // Strip HTML tags for preview
  const previewText = announcement.content
    .replace(/<[^>]*>/g, "")
    .slice(0, 100)
    .trim()

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpen}>
      <Card
        className={cn(
          "transition-colors",
          !announcement.isRead && "border-l-4 border-l-primary bg-primary/5"
        )}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer p-4 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  {!announcement.isRead && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                  <h4 className="text-sm font-semibold leading-none">
                    {announcement.title}
                  </h4>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {announcement.type === "system" ? (
                    <Globe className="h-3 w-3" />
                  ) : (
                    <Building2 className="h-3 w-3" />
                  )}
                  <span>
                    {announcement.type === "system"
                      ? "Platform"
                      : announcement.organizationName || "Organization"}
                  </span>
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(announcement.publishedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {announcement.priority !== "NORMAL" && (
                  <Badge
                    variant={priority.variant}
                    className={cn("text-xs", priority.className)}
                  >
                    {priority.label}
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CardContent className="px-4 pb-4 pt-0">
          {!isOpen && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {previewText}
              {previewText.length >= 100 && "..."}
            </p>
          )}
          <CollapsibleContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none pt-2 text-sm"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(announcement.content) }}
            />
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  )
}
