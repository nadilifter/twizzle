"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { AdyenCheckout, Dropin, Card, GooglePay } from "@adyen/adyen-web"
import type { CoreConfiguration } from "@adyen/adyen-web/auto"
import "@adyen/adyen-web/styles/adyen.css"
import { Loader2 } from "lucide-react"

interface AdyenCheckoutProps {
  sessionId: string
  sessionData: string
  onPaymentCompleted: (result: { resultCode: string; sessionData?: string }) => void
  onError: (error: { name?: string; message?: string; resultCode?: string }) => void
  countryCode?: string
  componentType?: string
  adyenConfig?: Partial<CoreConfiguration>
}

export function AdyenCheckoutComponent({
  sessionId,
  sessionData,
  onPaymentCompleted,
  onError,
  countryCode = "US",
  componentType = "dropin",
  adyenConfig,
}: AdyenCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedComponentRef = useRef<{ unmount(): void } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const onPaymentCompletedRef = useRef(onPaymentCompleted)
  onPaymentCompletedRef.current = onPaymentCompleted
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const stableOnPaymentCompleted = useCallback((result: any) => {
    onPaymentCompletedRef.current(result)
  }, [])

  const stableOnError = useCallback((error: any) => {
    onErrorRef.current(error)
  }, [])

  useEffect(() => {
    let cancelled = false

    const initAdyen = async () => {
      if (!sessionId || !sessionData) return

      try {
        const environment = process.env.NEXT_PUBLIC_ADYEN_ENVIRONMENT?.toLowerCase() || "test"
        const clientKey = process.env.NEXT_PUBLIC_ADYEN_CLIENT_KEY || "test_key"

        const checkout = await AdyenCheckout({
          environment: environment as CoreConfiguration["environment"],
          clientKey,
          countryCode,
          session: {
            id: sessionId,
            sessionData,
          },
          onPaymentCompleted: (result: any) => {
            stableOnPaymentCompleted(result)
          },
          onPaymentFailed: (result: any) => {
            stableOnError(result)
          },
          onError: (error: any) => {
            stableOnError(error)
          },
          ...adyenConfig,
        })

        if (cancelled || !containerRef.current) return

        if (mountedComponentRef.current) {
          mountedComponentRef.current.unmount()
          mountedComponentRef.current = null
        }

        const ComponentClass = componentType === "card" ? Card : Dropin
        const component = new ComponentClass(checkout, {
          ...(componentType !== "card" && { paymentMethodComponents: [Card, GooglePay] }),
        })
        component.mount(containerRef.current)
        mountedComponentRef.current = component as any
        setIsLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error("Adyen initialization failed", err)
        setIsLoading(false)
        stableOnError(err as any)
      }
    }

    setIsLoading(true)
    initAdyen()

    return () => {
      cancelled = true
      if (mountedComponentRef.current) {
        try {
          mountedComponentRef.current.unmount()
        } catch {
          // Component may already be unmounted
        }
        mountedComponentRef.current = null
      }
    }
  }, [sessionId, sessionData, countryCode, componentType, adyenConfig, stableOnPaymentCompleted, stableOnError])

  return (
    <div className="w-full">
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading payment form...</p>
        </div>
      )}
      <div ref={containerRef} className={isLoading ? "hidden" : "w-full"} />
    </div>
  )
}
