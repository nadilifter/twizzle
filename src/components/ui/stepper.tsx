"use client"

import * as React from "react"
import { createContext, useContext } from "react"
import { cn } from "@/lib/utils"
import { Check, Loader2 } from "lucide-react"

// Types
type StepperOrientation = "horizontal" | "vertical"
type StepState = "active" | "completed" | "inactive" | "loading"

interface StepperContextValue {
  activeStep: number
  setActiveStep: (step: number) => void
  stepsCount: number
  orientation: StepperOrientation
  canGoNext: boolean
  canGoPrev: boolean
  nextStep: () => void
  prevStep: () => void
}

interface StepItemContextValue {
  step: number
  state: StepState
  isDisabled: boolean
  isLoading: boolean
}

const StepperContext = createContext<StepperContextValue | undefined>(undefined)
const StepItemContext = createContext<StepItemContextValue | undefined>(undefined)

function useStepper() {
  const ctx = useContext(StepperContext)
  if (!ctx) throw new Error("useStepper must be used within a Stepper")
  return ctx
}

function useStepItem() {
  const ctx = useContext(StepItemContext)
  if (!ctx) throw new Error("useStepItem must be used within a StepperItem")
  return ctx
}

interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: number
  value?: number
  onValueChange?: (value: number) => void
  orientation?: StepperOrientation
  children: React.ReactNode
}

function Stepper({
  defaultValue = 1,
  value,
  onValueChange,
  orientation = "horizontal",
  className,
  children,
  ...props
}: StepperProps) {
  const [activeStep, setActiveStepState] = React.useState(defaultValue)

  const currentStep = value ?? activeStep

  const handleSetActiveStep = React.useCallback(
    (step: number) => {
      if (value === undefined) {
        setActiveStepState(step)
      }
      onValueChange?.(step)
    },
    [value, onValueChange]
  )

  // Count steps from children
  const stepsCount = React.Children.toArray(children).filter(
    (child): child is React.ReactElement =>
      React.isValidElement(child) &&
      (child.type as { displayName?: string }).displayName === "StepperItem"
  ).length

  const canGoNext = currentStep < stepsCount
  const canGoPrev = currentStep > 1

  const nextStep = React.useCallback(() => {
    if (canGoNext) {
      handleSetActiveStep(currentStep + 1)
    }
  }, [canGoNext, currentStep, handleSetActiveStep])

  const prevStep = React.useCallback(() => {
    if (canGoPrev) {
      handleSetActiveStep(currentStep - 1)
    }
  }, [canGoPrev, currentStep, handleSetActiveStep])

  const contextValue = React.useMemo<StepperContextValue>(
    () => ({
      activeStep: currentStep,
      setActiveStep: handleSetActiveStep,
      stepsCount,
      orientation,
      canGoNext,
      canGoPrev,
      nextStep,
      prevStep,
    }),
    [currentStep, handleSetActiveStep, stepsCount, orientation, canGoNext, canGoPrev, nextStep, prevStep]
  )

  return (
    <StepperContext.Provider value={contextValue}>
      <div
        className={cn("flex flex-col gap-4", className)}
        data-orientation={orientation}
        {...props}
      >
        {children}
      </div>
    </StepperContext.Provider>
  )
}

interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number
  completed?: boolean
  disabled?: boolean
  loading?: boolean
}

function StepperItem({
  step,
  completed = false,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const { activeStep } = useStepper()

  const state: StepState = loading && step === activeStep
    ? "loading"
    : completed || step < activeStep
    ? "completed"
    : activeStep === step
    ? "active"
    : "inactive"

  const isLoading = loading && step === activeStep

  return (
    <StepItemContext.Provider value={{ step, state, isDisabled: disabled, isLoading }}>
      <div
        className={cn("flex items-center gap-3", className)}
        data-state={state}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  )
}
StepperItem.displayName = "StepperItem"

interface StepperTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

function StepperTrigger({
  className,
  children,
  ...props
}: StepperTriggerProps) {
  const { state, isDisabled } = useStepItem()
  const { setActiveStep } = useStepper()
  const { step } = useStepItem()

  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-3 rounded-lg transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        state === "active" && "text-primary",
        state === "completed" && "text-primary",
        state === "inactive" && "text-muted-foreground",
        isDisabled && "pointer-events-none opacity-50",
        className
      )}
      onClick={() => setActiveStep(step)}
      disabled={isDisabled}
      {...props}
    >
      {children}
    </button>
  )
}

function StepperIndicator({ children, className }: React.ComponentProps<"div">) {
  const { state, isLoading, step } = useStepItem()

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
        state === "active" && "border-primary bg-primary text-primary-foreground",
        state === "completed" && "border-primary bg-primary text-primary-foreground",
        state === "inactive" && "border-muted-foreground/30 bg-muted text-muted-foreground",
        state === "loading" && "border-primary bg-primary text-primary-foreground",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : state === "completed" ? (
        <Check className="h-5 w-5" />
      ) : (
        children ?? step
      )}
    </div>
  )
}

function StepperSeparator({ className }: React.ComponentProps<"div">) {
  const { state } = useStepItem()
  const { orientation } = useStepper()

  return (
    <div
      className={cn(
        "transition-colors",
        orientation === "horizontal" && "h-0.5 flex-1 min-w-8",
        orientation === "vertical" && "ml-5 w-0.5 min-h-8",
        state === "completed" ? "bg-primary" : "bg-muted-foreground/30",
        className
      )}
    />
  )
}

function StepperTitle({ children, className }: React.ComponentProps<"h3">) {
  const { state } = useStepItem()

  return (
    <h3
      className={cn(
        "text-sm font-medium transition-colors",
        state === "active" && "text-foreground",
        state === "completed" && "text-foreground",
        state === "inactive" && "text-muted-foreground",
        className
      )}
    >
      {children}
    </h3>
  )
}

function StepperDescription({ children, className }: React.ComponentProps<"p">) {
  const { state } = useStepItem()

  return (
    <p
      className={cn(
        "text-xs transition-colors",
        state === "active" && "text-muted-foreground",
        state === "completed" && "text-muted-foreground",
        state === "inactive" && "text-muted-foreground/70",
        className
      )}
    >
      {children}
    </p>
  )
}

function StepperNav({ children, className }: React.ComponentProps<"nav">) {
  const { orientation } = useStepper()

  return (
    <nav
      className={cn(
        "flex",
        orientation === "horizontal" && "items-center justify-between gap-2",
        orientation === "vertical" && "flex-col items-start gap-0",
        className
      )}
    >
      {children}
    </nav>
  )
}

interface StepperContentProps extends React.ComponentProps<"div"> {
  value: number
  forceMount?: boolean
}

function StepperContent({
  value,
  forceMount,
  children,
  className,
}: StepperContentProps) {
  const { activeStep } = useStepper()
  const isActive = value === activeStep

  if (!forceMount && !isActive) {
    return null
  }

  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-right-4 duration-300",
        !isActive && "hidden",
        className
      )}
      data-state={isActive ? "active" : "inactive"}
    >
      {children}
    </div>
  )
}

export {
  useStepper,
  useStepItem,
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  StepperDescription,
  StepperNav,
  StepperContent,
  type StepperProps,
  type StepperItemProps,
  type StepperTriggerProps,
  type StepperContentProps,
}
