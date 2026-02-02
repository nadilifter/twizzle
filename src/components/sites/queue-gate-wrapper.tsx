"use client"

import { ReactNode } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useQueueGate } from "@/hooks/use-queue-gate"
import { ReservationTimer } from "./reservation-timer"

interface QueueGateWrapperProps {
  children: ReactNode
  programId?: string | null
}

export function QueueGateWrapper({ children, programId }: QueueGateWrapperProps) {
  const params = useParams()
  const slug = params.slug as string
  const { isChecking, isAllowed, hasReservation, reservation } = useQueueGate(slug, programId)

  if (isChecking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Checking availability...</p>
        </div>
      </div>
    )
  }

  if (!isAllowed) {
    // Redirect is happening, show loading
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Redirecting to queue...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      {hasReservation && reservation && (
        <ReservationTimer 
          expiresAt={reservation.expiresAt} 
          organizationSlug={slug}
        />
      )}
    </>
  )
}
