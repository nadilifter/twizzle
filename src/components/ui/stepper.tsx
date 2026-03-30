"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
import { defineStepper } from "@stepperize/react";
import type { StepStatus } from "@stepperize/react/primitives";

// Re-export defineStepper so consumers can import from one place
export { defineStepper };
export type { StepStatus };

/**
 * Derive the visual state label used for styling from a stepperize StepStatus.
 * stepperize uses "success" | "active" | "inactive"
 */
type VisualState = "completed" | "active" | "inactive";

function toVisualState(status: StepStatus): VisualState {
  if (status === "success") return "completed";
  if (status === "active") return "active";
  return "inactive";
}

// ---------- Nav container ----------

interface StepperNavProps extends React.ComponentProps<"nav"> {
  orientation?: "horizontal" | "vertical";
}

function StepperNav({
  orientation = "horizontal",
  className,
  children,
  ...props
}: StepperNavProps) {
  return (
    <nav
      className={cn(
        "flex",
        orientation === "horizontal" && "items-start justify-between gap-2",
        orientation === "vertical" && "flex-col items-start gap-0",
        className
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

// ---------- Step item wrapper ----------

interface StepperItemProps extends React.ComponentProps<"div"> {
  status: StepStatus;
}

function StepperItem({ status, className, children, ...props }: StepperItemProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-1", className)}
      data-state={toVisualState(status)}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------- Indicator (circle with number / check) ----------

interface StepperIndicatorProps extends React.ComponentProps<"button"> {
  status: StepStatus;
  step: number;
  loading?: boolean;
}

function StepperIndicator({
  status,
  step,
  loading = false,
  className,
  children,
  ...props
}: StepperIndicatorProps) {
  const visual = toVisualState(status);
  const isLoading = loading && status === "active";

  return (
    <button
      type="button"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        visual === "active" && "border-primary bg-primary text-primary-foreground",
        visual === "completed" && "border-primary bg-primary text-primary-foreground",
        visual === "inactive" && "border-muted-foreground/30 bg-muted text-muted-foreground",
        status === "inactive" && "cursor-default",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : visual === "completed" ? (
        <Check className="h-5 w-5" />
      ) : (
        (children ?? step)
      )}
    </button>
  );
}

// ---------- Separator line ----------

interface StepperSeparatorProps extends React.ComponentProps<"div"> {
  status: StepStatus;
  orientation?: "horizontal" | "vertical";
}

function StepperSeparator({
  status,
  orientation = "horizontal",
  className,
  ...props
}: StepperSeparatorProps) {
  const visual = toVisualState(status);

  return (
    <div
      className={cn(
        "transition-colors",
        orientation === "horizontal" && "mt-5 h-0.5 flex-1 min-w-4",
        orientation === "vertical" && "ml-5 w-0.5 min-h-8",
        visual === "completed" ? "bg-primary" : "bg-muted-foreground/30",
        className
      )}
      {...props}
    />
  );
}

// ---------- Title ----------

interface StepperTitleProps extends React.ComponentProps<"h3"> {
  status: StepStatus;
}

function StepperTitle({ status, className, children, ...props }: StepperTitleProps) {
  const visual = toVisualState(status);

  return (
    <h3
      className={cn(
        "text-xs font-medium transition-colors text-center whitespace-nowrap",
        (visual === "active" || visual === "completed") && "text-foreground",
        visual === "inactive" && "text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

// ---------- Description ----------

interface StepperDescriptionProps extends React.ComponentProps<"p"> {
  status: StepStatus;
}

function StepperDescription({ status, className, children, ...props }: StepperDescriptionProps) {
  const visual = toVisualState(status);

  return (
    <p
      className={cn(
        "text-xs transition-colors",
        (visual === "active" || visual === "completed") && "text-muted-foreground",
        visual === "inactive" && "text-muted-foreground/70",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}

// ---------- Content panel ----------

interface StepperContentProps extends React.ComponentProps<"div"> {
  active?: boolean;
  forceMount?: boolean;
}

function StepperContent({
  active = true,
  forceMount,
  className,
  children,
  ...props
}: StepperContentProps) {
  if (!forceMount && !active) {
    return null;
  }

  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-right-4 duration-300",
        !active && "hidden",
        className
      )}
      data-state={active ? "active" : "inactive"}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------- Utility: Compute status for a step by index ----------

function getStepStatus(index: number, currentIndex: number): StepStatus {
  if (index < currentIndex) return "success";
  if (index === currentIndex) return "active";
  return "inactive";
}

export {
  StepperNav,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  StepperDescription,
  StepperContent,
  getStepStatus,
};
