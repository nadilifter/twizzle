"use client"

import { useEffect, useRef } from "react"
import AdyenCheckout from "@adyen/adyen-web"
import "@adyen/adyen-web/dist/adyen.css"

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
    const initAdyen = async () => {
      const checkout = await AdyenCheckout({
        environment: "test", // Change to "live" in production
        clientKey: process.env.NEXT_PUBLIC_ADYEN_CLIENT_KEY || "test_key", // Needs to be in public env vars
        session: {
          id: sessionId,
          sessionData: sessionData,
        },
        onPaymentCompleted: (result: any, component: any) => {
          onPaymentCompleted(result)
        },
        onError: (error: any, component: any) => {
          onError(error)
        },
      })

      if (containerRef.current) {
        checkout.create("dropin").mount(containerRef.current)
      }
    }

    initAdyen()
  }, [sessionId, sessionData, onPaymentCompleted, onError])

  return <div ref={containerRef} className="w-full" />
}
