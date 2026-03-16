"use client"

import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TabsList } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface TabItem {
  value: string
  label: string
  disabled?: boolean
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (!node) return ""
  if (Array.isArray(node)) return node.map(extractText).filter(Boolean).join(" ")
  if (React.isValidElement(node)) {
    if (typeof node.type === "string" && node.type === "svg") return ""
    const props = node.props as Record<string, unknown>
    if (typeof props.className === "string" && /\bh-[34]\b/.test(props.className)) return ""
    return extractText(props.children as React.ReactNode)
  }
  return ""
}

function extractTabItems(children: React.ReactNode): TabItem[] {
  const items: TabItem[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as Record<string, unknown>
    if (typeof props.value !== "string") return
    items.push({
      value: props.value,
      label: extractText(props.children as React.ReactNode).trim() || props.value,
      disabled: !!props.disabled,
    })
  })
  return items
}

interface ResponsiveTabsListProps {
  children: React.ReactNode
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function ResponsiveTabsList({
  children,
  value,
  onValueChange,
  className,
}: ResponsiveTabsListProps) {
  const isMobile = useIsMobile()
  const items = React.useMemo(() => extractTabItems(children), [children])

  if (isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              disabled={item.disabled}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <TabsList className={cn("overflow-x-auto scrollbar-hide", className)}>
      {children}
    </TabsList>
  )
}
