"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Loader2, Clock, Users, CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface QueueStatus {
  inQueue: boolean
  canProceed: boolean
  status: string
  position?: number
  totalWaiting?: number
  estimatedWaitMinutes?: number
  reservation?: {
    id: string
    expiresAt: string
    remainingSeconds: number
    programId: string
  }
  message: string
}

export default function QueuePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const programId = searchParams.get("programId")
  const returnUrl = searchParams.get("returnUrl") || "/register"

  const [status, setStatus] = useState<QueueStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEntering, setIsEntering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Load session token from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`queue_session_${slug}`)
    if (stored) {
      setSessionToken(stored)
    }
  }, [slug])

  // Enter the queue
  const enterQueue = useCallback(async () => {
    setIsEntering(true)
    setError(null)
    try {
      const response = await fetch("/api/queue/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug: slug,
          programId,
          sessionToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to enter queue")
      }

      if (data.sessionToken) {
        localStorage.setItem(`queue_session_${slug}`, data.sessionToken)
        setSessionToken(data.sessionToken)
      }

      if (data.canProceed) {
        // User can proceed directly
        router.push(returnUrl)
        return
      }

      setStatus({
        inQueue: data.queued,
        canProceed: data.canProceed,
        status: data.entry?.status || "WAITING",
        position: data.position,
        estimatedWaitMinutes: data.estimatedWaitMinutes,
        message: data.message,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsEntering(false)
      setIsLoading(false)
    }
  }, [slug, programId, sessionToken, router, returnUrl])

  // Check queue status
  const checkStatus = useCallback(async () => {
    if (!sessionToken) return

    try {
      const response = await fetch(`/api/queue/status?sessionToken=${sessionToken}`)
      const data = await response.json()

      if (data.canProceed) {
        // User can now proceed
        router.push(returnUrl)
        return
      }

      setStatus({
        inQueue: data.inQueue,
        canProceed: data.canProceed,
        status: data.status,
        position: data.position,
        totalWaiting: data.totalWaiting,
        estimatedWaitMinutes: data.estimatedWaitMinutes,
        reservation: data.reservation,
        message: data.message,
      })
    } catch (err) {
      console.error("Error checking status:", err)
    }
  }, [sessionToken, router, returnUrl])

  // Initial load
  useEffect(() => {
    if (sessionToken) {
      checkStatus().then(() => setIsLoading(false))
    } else {
      enterQueue()
    }
  }, [sessionToken, checkStatus, enterQueue])

  // Poll for status updates every 5 seconds
  useEffect(() => {
    if (!sessionToken || status?.canProceed) return

    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [sessionToken, status?.canProceed, checkStatus])

  // Handle leaving the queue
  const handleLeave = async () => {
    if (!sessionToken) return

    try {
      await fetch("/api/queue/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      })
      localStorage.removeItem(`queue_session_${slug}`)
      router.push("/")
    } catch (err) {
      console.error("Error leaving queue:", err)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Checking queue status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-destructive/10 rounded-full w-fit">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.push("/")}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!status) {
    return null
  }

  // If admitted, show countdown
  if (status.status === "ADMITTED" && status.reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-green-100 dark:bg-green-900/20 rounded-full w-fit">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>You&apos;re In!</CardTitle>
            <CardDescription>Your spot is reserved. Please complete registration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">
                {Math.floor(status.reservation.remainingSeconds / 60)}:
                {String(status.reservation.remainingSeconds % 60).padStart(2, "0")}
              </div>
              <p className="text-sm text-muted-foreground">remaining to complete registration</p>
            </div>
            <Button className="w-full" size="lg" onClick={() => router.push(returnUrl)}>
              Continue to Registration
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Waiting in queue
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>You&apos;re in the Queue</CardTitle>
          <CardDescription>
            Please wait while we prepare your spot. Do not close this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Position Display */}
          <div className="text-center">
            <div className="text-6xl font-bold text-primary mb-2">
              #{status.position}
            </div>
            <p className="text-muted-foreground">Your position in line</p>
          </div>

          {/* Progress Bar */}
          {status.totalWaiting && (
            <div className="space-y-2">
              <Progress 
                value={((status.totalWaiting - (status.position || 0)) / status.totalWaiting) * 100} 
              />
              <p className="text-xs text-center text-muted-foreground">
                {status.totalWaiting} people waiting
              </p>
            </div>
          )}

          {/* Estimated Wait */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Estimated wait: ~{status.estimatedWaitMinutes} minute{status.estimatedWaitMinutes !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Info Box */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-center">
            <p>
              When it&apos;s your turn, you&apos;ll have{" "}
              <strong>10 minutes</strong> to complete your registration.
            </p>
          </div>

          {/* Leave Queue Button */}
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleLeave}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Leave Queue
          </Button>

          {/* Auto-refresh indicator */}
          <p className="text-xs text-center text-muted-foreground">
            <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
            Updating automatically...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
