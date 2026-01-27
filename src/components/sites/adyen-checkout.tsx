"use client"

import { useEffect, useRef } from "react"
// In @adyen/adyen-web v6+, AdyenCheckout is a named export
import { AdyenCheckout } from "@adyen/adyen-web"
import "@adyen/adyen-web/styles/adyen.css"

interface AdyenCheckoutProps {
  sessionId: string
  sessionData: string
  onPaymentCompleted: (result: any) => void
  onError: (error: any) => void
}

export function AdyenCheckoutComponent({
  sessionId,
  sessionData,
  onPaymentCompleted,
  onError,
}: AdyenCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let checkoutInstance: any = null

    const initAdyen = async () => {
      if (!sessionId || !sessionData) return

      try {
        // In v6, countryCode is mandatory
        const checkout = await AdyenCheckout({
          environment: "test", // Change to "live" in production
          clientKey: process.env.NEXT_PUBLIC_ADYEN_CLIENT_KEY || "test_key", // Needs to be in public env vars
          countryCode: "US", // Required in v6
          session: {
            id: sessionId,
            sessionData: sessionData,
          },
          onPaymentCompleted: (result: any, component: any) => {
            onPaymentCompleted(result)
          },
          onPaymentFailed: (result: any, component: any) => {
            // New in v6: separate handler for failed payments
            onError(result)
          },
          onError: (error: any, component: any) => {
            onError(error)
          },
        })

        if (containerRef.current) {
          // Clear previous instance if any
          containerRef.current.innerHTML = ''
          checkoutInstance = checkout
          checkout.create("dropin").mount(containerRef.current)
        }
      } catch (err) {
        console.error("Adyen initialization failed", err)
        onError(err)
      }
    }

    initAdyen()

    return () => {
      // Cleanup if needed, though Adyen usually handles this via mount/unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [sessionId, sessionData, onPaymentCompleted, onError])

  return <div ref={containerRef} className="w-full" />
}
