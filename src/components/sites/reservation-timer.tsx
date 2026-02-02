"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReservationTimerProps {
  expiresAt: string
  organizationSlug: string
  onExpired?: () => void
  className?: string
}

export function ReservationTimer({
  expiresAt,
  organizationSlug,
  onExpired,
  className,
}: ReservationTimerProps) {
  const router = useRouter()
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isExpired, setIsExpired] = useState(false)

  // Calculate initial remaining time
  useEffect(() => {
    const expiryTime = new Date(expiresAt).getTime()
    const now = Date.now()
    const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000))
    setRemainingSeconds(remaining)
    setIsExpired(remaining <= 0)
  }, [expiresAt])

  // Countdown timer
  useEffect(() => {
    if (remainingSeconds <= 0) {
      setIsExpired(true)
      onExpired?.()
      return
    }

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          setIsExpired(true)
          onExpired?.()
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [remainingSeconds, onExpired])

  // Redirect to queue when expired
  useEffect(() => {
    if (isExpired) {
      const timeout = setTimeout(() => {
        router.push(`/sites/${organizationSlug}/queue?expired=true`)
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [isExpired, router, organizationSlug])

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const isLow = remainingSeconds < 120 // Less than 2 minutes
  const isCritical = remainingSeconds < 60 // Less than 1 minute

  if (isExpired) {
    return (
      <div
        className={cn(
          "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg",
          "bg-destructive text-destructive-foreground",
          className
        )}
      >
        <AlertTriangle className="h-5 w-5" />
        <div>
          <div className="font-semibold">Reservation Expired</div>
          <div className="text-sm opacity-90">Redirecting to queue...</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-colors",
        isCritical
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : isLow
          ? "bg-amber-500 text-white"
          : "bg-primary text-primary-foreground",
        className
      )}
    >
      <Clock className="h-5 w-5" />
      <div>
        <div className="text-sm opacity-90">Time remaining</div>
        <div className="font-mono font-bold text-lg">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
      </div>
      {isLow && (
        <AlertTriangle className="h-5 w-5 ml-2" />
      )}
    </div>
  )
}

// Hook to use reservation timer data
export function useReservationTimer(expiresAt: string | null) {
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(0)
      setIsExpired(true)
      return
    }

    const expiryTime = new Date(expiresAt).getTime()
    const now = Date.now()
    const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000))
    setRemainingSeconds(remaining)
    setIsExpired(remaining <= 0)
  }, [expiresAt])

  useEffect(() => {
    if (!expiresAt || remainingSeconds <= 0) return

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          setIsExpired(true)
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt, remainingSeconds])

  return {
    remainingSeconds,
    isExpired,
    minutes: Math.floor(remainingSeconds / 60),
    seconds: remainingSeconds % 60,
    isLow: remainingSeconds < 120,
    isCritical: remainingSeconds < 60,
    formatted: `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`,
  }
}
