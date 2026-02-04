"use client"

import { useState, useEffect } from "react"
import { useCart } from "@/components/sites/cart-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { AdyenCheckoutComponent } from "@/components/sites/adyen-checkout"
import { toast } from "sonner"
import { useRouter, useParams } from "next/navigation"
import { useQueueGate, useCompleteRegistration } from "@/hooks/use-queue-gate"
import { ReservationTimer } from "@/components/sites/reservation-timer"

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const { items, subtotal, removeItem, clearCart } = useCart()
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  })
  const [discountCode, setDiscountCode] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSession, setPaymentSession] = useState<{ id: string; sessionData: string } | null>(null)

  // Queue gate - check if user has valid reservation
  const { isChecking, isAllowed, hasReservation, reservation } = useQueueGate(params.slug)
  const { complete: completeRegistration } = useCompleteRegistration(params.slug)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleProceedToPayment = async () => {
    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email) {
        toast.error("Please fill in all required fields")
        return
    }

    setIsProcessing(true)

    try {
        const response = await fetch(`/api/sites/${params.slug}/checkout/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items,
                userDetails: formData,
                discountCode
            })
        })

        if (!response.ok) throw new Error("Failed to create payment session")

        const data = await response.json()
        setPaymentSession({ id: data.sessionId, sessionData: data.sessionData })
    } catch (error) {
        console.error(error)
        toast.error("Failed to initialize payment. Please try again.")
    } finally {
        setIsProcessing(false)
    }
  }

  const handlePaymentCompleted = async (result: any) => {
     // Adyen handles the redirect usually, but we can also handle it here
     // If resultCode is Authorised, clear cart and redirect
     if (result.resultCode === "Authorised" || result.resultCode === "Pending" || result.resultCode === "Received") {
         clearCart()
         // Complete the queue registration to free up the spot
         await completeRegistration()
         // The returnUrl in the session will handle the redirect, but Adyen Web might expect us to do something if not configured to redirect
         // For 'dropin', it usually redirects or we handle it.
         // We set returnUrl in the API, so Adyen should use it.
     }
  }

  const taxRate = 0.13 // Mock HST
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount

  // Show loading while checking queue status
  if (isChecking) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Checking availability...</p>
      </div>
    )
  }

  // Redirect is happening if not allowed
  if (!isAllowed) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Redirecting to queue...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Checkout</h1>
        <p className="text-muted-foreground mb-8">Your cart is empty.</p>
        <Button asChild>
          <Link href={`/sites/${params.slug}/register`}>Browse Programs</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* User Details */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                We&apos;ll use this to create your account and send your receipt.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input 
                  id="firstName" 
                  name="firstName" 
                  value={formData.firstName} 
                  onChange={handleInputChange} 
                  required 
                  disabled={!!paymentSession}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input 
                  id="lastName" 
                  name="lastName" 
                  value={formData.lastName} 
                  onChange={handleInputChange} 
                  required 
                  disabled={!!paymentSession}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  required 
                  disabled={!!paymentSession}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  type="tel" 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  required 
                  disabled={!!paymentSession}
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing Address (Simplified) */}
          <Card>
             <CardHeader>
              <CardTitle>Billing Address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
                 <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Input 
                  id="address" 
                  name="address" 
                  value={formData.address} 
                  onChange={handleInputChange} 
                  disabled={!!paymentSession}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input 
                  id="city" 
                  name="city" 
                  value={formData.city} 
                  onChange={handleInputChange} 
                  disabled={!!paymentSession}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input 
                  id="postalCode" 
                  name="postalCode" 
                  value={formData.postalCode} 
                  onChange={handleInputChange} 
                  disabled={!!paymentSession}
                />
              </div>
            </CardContent>
            {!paymentSession && (
                <CardFooter>
                    <Button onClick={handleProceedToPayment} disabled={isProcessing} className="w-full">
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Proceed to Payment
                    </Button>
                </CardFooter>
            )}
          </Card>

          {/* Payment Section */}
          {paymentSession && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                  <CardDescription>
                    Secure payment via Adyen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                    <div id="adyen-checkout-container" className="min-h-[200px]">
                        <AdyenCheckoutComponent 
                            sessionId={paymentSession.id}
                            sessionData={paymentSession.sessionData}
                            onPaymentCompleted={handlePaymentCompleted}
                            onError={(err) => console.error("Adyen Error", err)}
                        />
                    </div>
                </CardContent>
              </Card>
          )}
        </div>

        {/* Right Column - Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 text-sm">
                    <div className="flex-1">
                        <span className="font-medium">{item.name}</span>
                        <div className="text-xs text-muted-foreground mt-1">
                            Qty: {item.quantity} 
                            {!paymentSession && (
                                <button 
                                    onClick={() => removeItem(item.id)}
                                    className="ml-2 text-destructive hover:underline"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <Separator />

              <div className="space-y-2">
                <Label htmlFor="discount">Discount Code</Label>
                <div className="flex gap-2">
                    <Input 
                        id="discount" 
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value)}
                        placeholder="Enter code"
                        disabled={!!paymentSession}
                    />
                    <Button variant="outline" disabled={!!paymentSession}>Apply</Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (13%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Reservation Timer - shows countdown when user has a queue reservation */}
      {hasReservation && reservation && (
        <ReservationTimer 
          expiresAt={reservation.expiresAt} 
          organizationSlug={params.slug}
        />
      )}
    </div>
  )
}
