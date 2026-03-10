"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Loader2, MapPin, Calendar } from "lucide-react"
import { format } from "date-fns"

type EntityType = "program" | "event" | "competition"

interface EntityItem {
  id: string
  name: string
  status?: string
  type?: string
  date?: string
  startDate?: string
  endDate?: string
  facilityName?: string | null
}

interface CopySettingsDialogProps {
  entityType: EntityType
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (id: string) => Promise<void>
}

const ENTITY_LABELS: Record<EntityType, string> = {
  program: "Program",
  event: "Event",
  competition: "Competition",
}

function formatDateRange(startDate?: string, endDate?: string): string | null {
  if (!startDate) return null
  try {
    const start = new Date(startDate + "T12:00:00Z")
    const startStr = format(start, "MMM d, yyyy")
    if (!endDate) return startStr
    const end = new Date(endDate + "T12:00:00Z")
    return `${startStr} – ${format(end, "MMM d, yyyy")}`
  } catch {
    return null
  }
}

function normalizeItems(entityType: EntityType, data: any): EntityItem[] {
  if (entityType === "program") {
    const items = data.data || data
    return (items as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      startDate: p.startDate?.slice?.(0, 10) || undefined,
      endDate: p.endDate?.slice?.(0, 10) || undefined,
      facilityName: p.facility?.name || null,
    }))
  }

  if (entityType === "event") {
    const items = data.data || data
    return (items as any[]).map((e) => ({
      id: e.id,
      name: e.title,
      type: e.type,
      date: e.date?.slice?.(0, 10) || undefined,
      facilityName: e.facility?.name || null,
    }))
  }

  // competition
  const items = Array.isArray(data) ? data : data.data || data
  return (items as any[]).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    type: c.competitionType?.replace(/_/g, " "),
    startDate: c.startDate?.slice?.(0, 10) || undefined,
    endDate: c.endDate?.slice?.(0, 10) || undefined,
    facilityName: c.facility?.name || null,
  }))
}

const API_PATHS: Record<EntityType, string> = {
  program: "/api/programs?limit=200",
  event: "/api/events?limit=200",
  competition: "/api/competitions",
}

export function CopySettingsDialog({
  entityType,
  open,
  onOpenChange,
  onSelect,
}: CopySettingsDialogProps) {
  const [items, setItems] = React.useState<EntityItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [copying, setCopying] = React.useState(false)
  const label = ENTITY_LABELS[entityType]

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)

    fetch(API_PATHS[entityType])
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setItems(normalizeItems(entityType, data))
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, entityType])

  const handleSelect = React.useCallback(async (id: string) => {
    setCopying(true)
    try {
      await onSelect(id)
      onOpenChange(false)
    } finally {
      setCopying(false)
    }
  }, [onSelect, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={copying ? undefined : onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-lg"
        onPointerDownOutside={copying ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={copying ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle>Copy Settings from Existing {label}</DialogTitle>
          <DialogDescription>
            {copying
              ? "Copying settings..."
              : `Select a ${label.toLowerCase()} to copy its settings. The name and staff will not be copied.`}
          </DialogDescription>
        </DialogHeader>

        {loading || copying ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            {copying && (
              <p className="text-sm text-muted-foreground">Copying settings...</p>
            )}
          </div>
        ) : (
          <Command className="border-t">
            <CommandInput placeholder={`Search ${label.toLowerCase()}s...`} />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>No {label.toLowerCase()}s found.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => {
                  const dateStr =
                    item.date
                      ? formatDateRange(item.date)
                      : formatDateRange(item.startDate, item.endDate)

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => handleSelect(item.id)}
                      className="flex flex-col items-start gap-1 px-4 py-3"
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {item.status && (
                          <Badge variant="secondary" className="ml-auto text-xs capitalize">
                            {item.status.toLowerCase().replace(/_/g, " ")}
                          </Badge>
                        )}
                        {item.type && !item.status && (
                          <Badge variant="outline" className="ml-auto text-xs capitalize">
                            {item.type.toLowerCase()}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {dateStr && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {dateStr}
                          </span>
                        )}
                        {item.facilityName && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.facilityName}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </DialogContent>
    </Dialog>
  )
}
