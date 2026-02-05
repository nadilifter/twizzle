"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { ArrowLeft, CreditCard, Loader2, Shield, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdyenCheckoutComponent } from "@/components/sites/adyen-checkout"
import Link from "next/link"

interface SignupFormData {
  email: string
  password: string
  confirmPassword: string
  name: string
  orgName: string
  orgEmail: string
  phone: string
  street: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
  subdomain: string
  primaryColor: string
  secondaryColor: string
  planId: string
  planName: string
  planPrice: string
}

function PaymentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [paymentComplete, setPaymentComplete] = React.useState(false)
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [sessionData, setSessionData] = React.useState<string | null>(null)
  const [formData, setFormData] = React.useState<SignupFormData | null>(null)
  const [shopperReference, setShopperReference] = React.useState<string | null>(null)

  // Get signup data from session storage
  React.useEffect(() => {
    const storedData = sessionStorage.getItem("org-signup-data")
    if (!storedData) {
      toast.error("Please complete the signup form first")
      router.push("/org-signup")
      return
    }

    try {
      const data = JSON.parse(storedData) as SignupFormData
      setFormData(data)
      initializePaymentSession(data)
    } catch {
      toast.error("Invalid signup data")
      router.push("/org-signup")
    }
  }, [router])

  const initializePaymentSession = async (data: SignupFormData) => {
    try {
      const signupReference = `${data.subdomain}-${Date.now()}`
      const returnUrl = `${window.location.origin}/org-signup/payment?complete=true`

      const response = await fetch("/api/org-signup/payment-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupReference,
          email: data.email,
          returnUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create payment session")
      }

      const session = await response.json()
      setSessionId(session.sessionId)
      setSessionData(session.sessionData)
      setShopperReference(session.shopperReference)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to initialize payment")
      router.push("/org-signup")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentCompleted = async (result: { resultCode: string }) => {
    if (result.resultCode === "Authorised" || result.resultCode === "Pending") {
      setPaymentComplete(true)
      await createOrganization()
    } else {
      toast.error(`Payment failed: ${result.resultCode}`)
    }
  }

  const handlePaymentError = (error: { message?: string }) => {
    console.error("Payment error:", error)
    toast.error(error?.message || "Payment failed. Please try again.")
  }

  const createOrganization = async () => {
    if (!formData || !shopperReference) return

    setIsSubmitting(true)
    try {
      // Include the Adyen shopper reference in the signup request
      const response = await fetch("/api/org-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          adyenShopperReference: shopperReference,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create organization")
      }

      // Clear session storage
      sessionStorage.removeItem("org-signup-data")

      toast.success("Organization created successfully!")
      router.push(`/org-signup/success?subdomain=${formData.subdomain}&orgName=${encodeURIComponent(formData.orgName)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
      setIsSubmitting(false)
      setPaymentComplete(false)
    }
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(Number(amount))
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Preparing secure payment...</p>
      </div>
    )
  }

  if (paymentComplete || isSubmitting) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center py-12">
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
        <p className="text-muted-foreground mb-4">Creating your organization...</p>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Back link */}
      <Link 
        href="/org-signup" 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to signup
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Complete Your Signup</h1>
        <p className="text-muted-foreground">
          Add a payment method to start your 30-day free trial
        </p>
      </div>

      {/* Order summary */}
      {formData && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium">{formData.orgName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{formData.planName}</span>
            </div>
            <div className="flex justify-between items-center border-t pt-2 mt-2">
              <span className="text-muted-foreground">Due today</span>
              <span className="font-bold text-green-600">$0.00</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">After 30-day trial</span>
              <span className="text-muted-foreground">
                {formatCurrency(formData.planPrice)}/mo
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Payment Method</CardTitle>
          </div>
          <CardDescription>
            Your card will not be charged during the trial period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionId && sessionData ? (
            <AdyenCheckoutComponent
              sessionId={sessionId}
              sessionData={sessionData}
              onPaymentCompleted={handlePaymentCompleted}
              onError={handlePaymentError}
            />
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security notice */}
      <div className="flex items-start gap-2 mt-6 p-3 rounded-lg bg-muted/50">
        <Shield className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Secure Payment</p>
          <p>
            Your payment information is encrypted and processed securely by Adyen.
            You can cancel anytime during your trial.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
