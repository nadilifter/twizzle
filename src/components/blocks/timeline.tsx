import * as React from "react"
import { cn } from "@/lib/utils"

type TimelineVariant = "default" | "secondary" | "outline" | "destructive"

interface TimelineProps {
  orientation?: "vertical" | "horizontal"
  noCards?: boolean
  vertItemSpacing?: number
  children: React.ReactNode
  className?: string
}

interface TimelineItemProps {
  variant?: TimelineVariant
  hollow?: boolean
  children: React.ReactNode
  className?: string
}

interface TimelineItemChildProps {
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<TimelineVariant, { dot: string; line: string }> = {
  default: {
    dot: "border-primary bg-primary",
    line: "bg-primary/20",
  },
  secondary: {
    dot: "border-secondary bg-secondary",
    line: "bg-secondary/30",
  },
  outline: {
    dot: "border-muted-foreground bg-muted-foreground",
    line: "bg-muted-foreground/20",
  },
  destructive: {
    dot: "border-destructive bg-destructive",
    line: "bg-destructive/20",
  },
}

const hollowStyles: Record<TimelineVariant, string> = {
  default: "border-primary bg-background",
  secondary: "border-secondary bg-background",
  outline: "border-muted-foreground bg-background",
  destructive: "border-destructive bg-background",
}

function Timeline({
  orientation = "vertical",
  noCards: _noCards,
  vertItemSpacing,
  children,
  className,
}: TimelineProps) {
  const items = React.Children.toArray(children)

  if (orientation === "vertical") {
    return (
      <div className={cn("relative", className)}>
        {items.map((child, idx) => (
          <div
            key={idx}
            className="relative pl-8"
            style={
              vertItemSpacing && idx < items.length - 1
                ? { marginBottom: vertItemSpacing }
                : idx < items.length - 1
                  ? { marginBottom: 24 }
                  : undefined
            }
          >
            {idx < items.length - 1 && (
              <div className="absolute left-[7px] top-[18px] bottom-[-24px] w-[2px] bg-border" style={
                vertItemSpacing ? { bottom: -(vertItemSpacing - 0) } : undefined
              } />
            )}
            {child}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("flex items-start gap-8", className)}>
      {items.map((child, idx) => (
        <div key={idx} className="relative flex-1 pt-6">
          {idx < items.length - 1 && (
            <div className="absolute top-[11px] left-[18px] right-0 h-[2px] bg-border" />
          )}
          {child}
        </div>
      ))}
    </div>
  )
}

function TimelineItem({ variant = "default", hollow = false, children, className }: TimelineItemProps) {
  const styles = variantStyles[variant]
  const dotClass = hollow ? hollowStyles[variant] : styles.dot

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "absolute left-[-25px] top-[6px] h-4 w-4 rounded-full border-2 shrink-0",
          dotClass,
        )}
      />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function TimelineItemDate({ children, className }: TimelineItemChildProps) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {children}
    </p>
  )
}

function TimelineItemTitle({ children, className }: TimelineItemChildProps) {
  return (
    <p className={cn("text-sm font-medium", className)}>
      {children}
    </p>
  )
}

export default Timeline
export { Timeline, TimelineItem, TimelineItemDate, TimelineItemTitle }
