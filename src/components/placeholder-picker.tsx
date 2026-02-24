"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Search, ChevronDown, User, Users, CreditCard, BookOpen, Calendar, Building2, Clock, Wallet } from "lucide-react"
import type { Editor } from "@tiptap/react"

export interface PlaceholderDefinition {
  key: string
  label: string
  description: string
  example: string
  category: string
}

interface PlaceholderPickerProps {
  editor: Editor | null
  placeholders: PlaceholderDefinition[]
  className?: string
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  athlete: { label: "Athlete", icon: User },
  guardian: { label: "Guardian", icon: Users },
  membership: { label: "Membership", icon: CreditCard },
  program: { label: "Program", icon: BookOpen },
  event: { label: "Event", icon: Calendar },
  payment: { label: "Payment", icon: Wallet },
  organization: { label: "Organization", icon: Building2 },
  date: { label: "Date & Time", icon: Clock },
}

export function PlaceholderPicker({ editor, placeholders, className }: PlaceholderPickerProps) {
  const [search, setSearch] = useState("")
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(["guardian", "athlete"]))

  const filteredByCategory = useMemo(() => {
    const filtered = search
      ? placeholders.filter(
          (p) =>
            p.label.toLowerCase().includes(search.toLowerCase()) ||
            p.key.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase())
        )
      : placeholders

    const grouped: Record<string, PlaceholderDefinition[]> = {}
    for (const p of filtered) {
      if (!grouped[p.category]) {
        grouped[p.category] = []
      }
      grouped[p.category].push(p)
    }
    return grouped
  }, [placeholders, search])

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleInsert = (key: string) => {
    if (!editor) return
    editor.chain().focus().insertPlaceholder(key).run()
  }

  const categoryOrder = ["guardian", "athlete", "program", "event", "membership", "payment", "organization", "date"]

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search placeholders..."
            className="pl-8 h-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
        {categoryOrder
          .filter((cat) => filteredByCategory[cat]?.length)
          .map((category) => {
            const config = CATEGORY_CONFIG[category] || { label: category, icon: User }
            const Icon = config.icon
            const items = filteredByCategory[category]
            const isOpen = openCategories.has(category) || search.length > 0

            return (
              <Collapsible
                key={category}
                open={isOpen}
                onOpenChange={() => toggleCategory(category)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{config.label}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">
                      {items.length}
                    </Badge>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
                    {items.map((p) => (
                      <TooltipProvider key={p.key} delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleInsert(p.key)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900"
                            >
                              {p.label}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px]">
                            <p className="font-medium text-xs">{p.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Example: <span className="font-mono">{p.example}</span>
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}

        {Object.keys(filteredByCategory).length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No placeholders match your search.
          </p>
        )}
      </div>
    </div>
  )
}
