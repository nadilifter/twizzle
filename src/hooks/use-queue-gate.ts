"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"

interface QueueGateResult {
  isChecking: boolean
  isAllowed: boolean
  hasReservation: boolean
  reservation: {
    expiresAt: string
    remainingSeconds: number
  } | null
  sessionToken: string | null
}

/**
 * Hook to check if user is allowed to access registration/checkout pages.
 * If they need to be in queue and don't have a valid reservation, redirects to queue page.
 */
export function useQueueGate(organizationSlug: string, programId?: string | null): QueueGateResult {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const [isAllowed, setIsAllowed] = useState(false)
  const [reservation, setReservation] = useState<QueueGateResult["reservation"]>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  const checkQueue = useCallback(async () => {
    // Skip if already on queue page
    if (pathname.includes("/queue")) {
      setIsChecking(false)
      setIsAllowed(true)
      return
    }

    setIsChecking(true)

    try {
      // Get session token from localStorage
      const stored = localStorage.getItem(`queue_session_${organizationSlug}`)
      setSessionToken(stored)

      // Enter queue or check existing status
      const response = await fetch("/api/queue/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          programId,
          sessionToken: stored,
        }),
      })

      const data = await response.json()

      // Save session token if provided
      if (data.sessionToken) {
        localStorage.setItem(`queue_session_${organizationSlug}`, data.sessionToken)
        setSessionToken(data.sessionToken)
      }

      if (data.canProceed) {
        // User can proceed (no queue, or has valid reservation)
        setIsAllowed(true)
        if (data.reservation) {
          const expiresAt = new Date(data.reservation.expiresAt)
          const now = new Date()
          setReservation({
            expiresAt: data.reservation.expiresAt,
            remainingSeconds: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
          })
        }
      } else {
        // User needs to queue - redirect
        setIsAllowed(false)
        const returnUrl = encodeURIComponent(pathname)
        const queueUrl = `/sites/${organizationSlug}/queue?programId=${programId || ""}&returnUrl=${returnUrl}`
        router.replace(queueUrl)
      }
    } catch (error) {
      console.error("Error checking queue:", error)
      // On error, allow through (fail open)
      setIsAllowed(true)
    } finally {
      setIsChecking(false)
    }
  }, [organizationSlug, programId, pathname, router])

  useEffect(() => {
    checkQueue()
  }, [checkQueue])

  return {
    isChecking,
    isAllowed,
    hasReservation: !!reservation,
    reservation,
    sessionToken,
  }
}

/**
 * Hook to complete registration when checkout is successful.
 * Call this after a successful payment/registration.
 */
export function useCompleteRegistration(organizationSlug: string) {
  const complete = useCallback(async () => {
    const sessionToken = localStorage.getItem(`queue_session_${organizationSlug}`)
    if (!sessionToken) return

    try {
      await fetch("/api/queue/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      })
      localStorage.removeItem(`queue_session_${organizationSlug}`)
    } catch (error) {
      console.error("Error completing registration:", error)
    }
  }, [organizationSlug])

  return { complete }
}
