"use client"

import { useState, useEffect, useRef } from "react"
import { useCart, CartItem } from "@/components/sites/cart-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, Trash2, FileText, Check, ChevronRight, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { AdyenCheckoutComponent } from "@/components/sites/adyen-checkout"
import { SignaturePad, SignaturePadRef } from "@/components/ui/signature-pad"
import { toast } from "sonner"
import { useRouter, useParams } from "next/navigation"
import { useQueueGate, useCompleteRegistration } from "@/hooks/use-queue-gate"
import { ReservationTimer } from "@/components/sites/reservation-timer"
import { RemoveItemDialog } from "@/components/sites/remove-item-dialog"

type CheckoutStep = "details" | "waivers" | "payment"

interface WaiverToSign {
  waiverId: string
  waiverTitle: string
  isSigned: boolean
}

interface WaiverPageData {
  id: string
  pageNumber: number
  title: string | null
  content: string
}

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const { items, subtotal, removeItem, clearCart, getDependentItems, removeItemWithDependents } = useCart()
  const router = useRouter()
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("details")
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

  // Waiver state
  const [requiredWaivers, setRequiredWaivers] = useState<WaiverToSign[]>([])
  const [currentWaiverIndex, setCurrentWaiverIndex] = useState(0)
  const [currentWaiverPages, setCurrentWaiverPages] = useState<WaiverPageData[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [isLoadingWaiver, setIsLoadingWaiver] = useState(false)
  const [isSigningWaiver, setIsSigningWaiver] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [signAllMode, setSignAllMode] = useState(false)
  const signaturePadRef = useRef<SignaturePadRef>(null)
  const [signatureEmpty, setSignatureEmpty] = useState(true)

  // State for remove confirmation dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null)
  const [dependentItems, setDependentItems] = useState<CartItem[]>([])

  const handleRemoveClick = (item: CartItem) => {
    const dependents = getDependentItems(item.id)
    
    if (dependents.length > 0) {
      setItemToRemove(item)
      setDependentItems(dependents)
      setRemoveDialogOpen(true)
    } else {
      removeItem(item.id)
    }
  }

  const handleConfirmRemove = () => {
    if (itemToRemove) {
      removeItemWithDependents(itemToRemove.id)
    }
    setRemoveDialogOpen(false)
    setItemToRemove(null)
    setDependentItems([])
  }

  const handleCancelRemove = () => {
    setRemoveDialogOpen(false)
    setItemToRemove(null)
    setDependentItems([])
  }

  // Queue gate
  const { isChecking, isAllowed, hasReservation, reservation } = useQueueGate(params.slug)
  const { complete: completeRegistration } = useCompleteRegistration(params.slug)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Check for required waivers and proceed accordingly
  const handleProceedToPayment = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsProcessing(true)

    try {
      // First, get the org ID from the site config
      const siteResponse = await fetch(`/api/public/site-config?slug=${params.slug}`)
      let orgId = organizationId

      if (siteResponse.ok) {
        const siteData = await siteResponse.json()
        orgId = siteData.organizationId
        setOrganizationId(orgId)
      }

      // Collect program IDs from cart to check for waiver requirements
      const programIds = items
        .filter((item) => item.type === "program")
        .map((item) => item.details?.programId || item.referenceId)
        .filter(Boolean)

      if (programIds.length > 0 && orgId) {
        // Fetch programs to check for waiver requirements
        const programsResponse = await fetch(
          `/api/public/programs/waiver-requirements?programIds=${programIds.join(",")}&organizationId=${orgId}`
        )

        if (programsResponse.ok) {
          const programsData = await programsResponse.json()
          const requiredWaiverIds: string[] = programsData.waiverIds || []

          if (requiredWaiverIds.length > 0) {
            // Check which waivers are already signed
            const checkResponse = await fetch("/api/public/waivers/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: formData.email,
                waiverIds: requiredWaiverIds,
                organizationId: orgId,
              }),
            })

            if (checkResponse.ok) {
              const checkData = await checkResponse.json()
              setFamilyId(checkData.familyId)

              if (!checkData.allSigned) {
                // Show waiver signing step
                const unsignedWaivers = checkData.data.filter((w: WaiverToSign) => !w.isSigned)
                setRequiredWaivers(unsignedWaivers)
                setCurrentWaiverIndex(0)
                setCheckoutStep("waivers")
                // Load the first waiver
                await loadWaiverContent(unsignedWaivers[0].waiverId, orgId)
                setIsProcessing(false)
                return
              }
            }
          }
        }
      }

      // No waivers needed or all already signed -- proceed to payment
      await createPaymentSession()
    } catch (error) {
      console.error(error)
      toast.error("Failed to process. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const loadWaiverContent = async (waiverId: string, orgId: string) => {
    setIsLoadingWaiver(true)
    try {
      const response = await fetch(`/api/public/waivers/${waiverId}?organizationId=${orgId}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentWaiverPages(data.pages || [])
        setCurrentPageIndex(0)
      }
    } catch (error) {
      console.error("Failed to load waiver:", error)
    } finally {
      setIsLoadingWaiver(false)
    }
  }

  const handleSignCurrentPage = async () => {
    if (signaturePadRef.current?.isEmpty()) {
      toast.error("Please provide your signature")
      return
    }

    const signatureData = signaturePadRef.current!.toDataURL()
    setIsSigningWaiver(true)

    try {
      const currentWaiver = requiredWaivers[currentWaiverIndex]
      
      // Determine which pages to sign
      const pagesToSign = signAllMode
        ? currentWaiverPages.map((page) => ({
            waiverPageId: page.id,
            signatureData,
          }))
        : [
            {
              waiverPageId: currentWaiverPages[currentPageIndex].id,
              signatureData,
            },
          ]

      const response = await fetch(`/api/public/waivers/${currentWaiver.waiverId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          familyId,
          email: formData.email,
          name: `${formData.firstName} ${formData.lastName}`,
          signatures: pagesToSign,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to sign waiver")
      }

      const result = await response.json()
      setFamilyId(result.familyId)

      if (result.allPagesSigned || signAllMode) {
        // This waiver is complete - move to next waiver or proceed to payment
        toast.success(`"${currentWaiver.waiverTitle}" signed successfully`)
        
        if (currentWaiverIndex < requiredWaivers.length - 1) {
          const nextIndex = currentWaiverIndex + 1
          setCurrentWaiverIndex(nextIndex)
          setSignAllMode(false)
          signaturePadRef.current?.clear()
          setSignatureEmpty(true)
          await loadWaiverContent(requiredWaivers[nextIndex].waiverId, organizationId!)
        } else {
          // All waivers signed - proceed to payment
          setCheckoutStep("payment")
          await createPaymentSession()
        }
      } else {
        // More pages to sign for this waiver
        setCurrentPageIndex((prev) => prev + 1)
        signaturePadRef.current?.clear()
        setSignatureEmpty(true)
      }
    } catch (error: any) {
      console.error("Failed to sign waiver:", error)
      toast.error(error.message || "Failed to sign waiver")
    } finally {
      setIsSigningWaiver(false)
    }
  }

  const createPaymentSession = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/sites/${params.slug}/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          userDetails: formData,
          discountCode,
        }),
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || "Failed to create payment session")
      }

      const data = await response.json()
      setPaymentSession({ id: data.sessionId, sessionData: data.sessionData })
      setCheckoutStep("payment")
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to initialize payment. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePaymentCompleted = async (result: any) => {
    if (result.resultCode === "Authorised" || result.resultCode === "Pending" || result.resultCode === "Received") {
      clearCart()
      await completeRegistration()
    }
  }

  const taxRate = 0.13
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
                  disabled={checkoutStep !== "details"}
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
                  disabled={checkoutStep !== "details"}
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
                  disabled={checkoutStep !== "details"}
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
                  disabled={checkoutStep !== "details"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
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
                  disabled={checkoutStep !== "details"}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input 
                  id="city" 
                  name="city" 
                  value={formData.city} 
                  onChange={handleInputChange} 
                  disabled={checkoutStep !== "details"}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input 
                  id="postalCode" 
                  name="postalCode" 
                  value={formData.postalCode} 
                  onChange={handleInputChange} 
                  disabled={checkoutStep !== "details"}
                />
              </div>
            </CardContent>
            {checkoutStep === "details" && (
                <CardFooter>
                    <Button onClick={handleProceedToPayment} disabled={isProcessing} className="w-full">
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Proceed to Payment
                    </Button>
                </CardFooter>
            )}
          </Card>

          {/* Waiver Signing Step */}
          {checkoutStep === "waivers" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Waiver Required
                </CardTitle>
                <CardDescription>
                  Please review and sign the following waiver{requiredWaivers.length > 1 ? "s" : ""} before proceeding to payment.
                  {requiredWaivers.length > 1 && (
                    <span className="block mt-1">
                      Waiver {currentWaiverIndex + 1} of {requiredWaivers.length}: <strong>{requiredWaivers[currentWaiverIndex]?.waiverTitle}</strong>
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingWaiver ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Page indicator */}
                    {currentWaiverPages.length > 1 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        Page {currentPageIndex + 1} of {currentWaiverPages.length}
                        {currentWaiverPages[currentPageIndex]?.title && (
                          <span>: {currentWaiverPages[currentPageIndex].title}</span>
                        )}
                      </div>
                    )}

                    {/* Waiver content */}
                    <div className="border rounded-lg p-6 max-h-[400px] overflow-y-auto bg-card">
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: currentWaiverPages[currentPageIndex]?.content || "",
                        }}
                      />
                    </div>

                    {/* Sign all option */}
                    {currentWaiverPages.length > 1 && currentPageIndex === 0 && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={signAllMode}
                          onChange={(e) => setSignAllMode(e.target.checked)}
                          className="rounded border-border"
                        />
                        <span className="text-sm">
                          Sign all {currentWaiverPages.length} pages at once with a single signature
                        </span>
                      </label>
                    )}

                    {/* Signature pad */}
                    <div className="space-y-2">
                      <Label>Your Signature</Label>
                      <p className="text-sm text-muted-foreground">
                        By signing below, I acknowledge that I have read and agree to the terms above.
                      </p>
                      <SignaturePad
                        ref={signaturePadRef}
                        height={150}
                        onSignatureChange={(isEmpty) => setSignatureEmpty(isEmpty)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCheckoutStep("details")
                    setRequiredWaivers([])
                  }}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSignCurrentPage}
                  disabled={isSigningWaiver || signatureEmpty || isLoadingWaiver}
                >
                  {isSigningWaiver && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {signAllMode ? "Sign All Pages & Continue" : (
                    currentPageIndex < currentWaiverPages.length - 1
                      ? "Sign & Next Page"
                      : currentWaiverIndex < requiredWaivers.length - 1
                        ? "Sign & Next Waiver"
                        : "Sign & Proceed to Payment"
                  )}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Payment Section */}
          {checkoutStep === "payment" && paymentSession && (
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
                            {checkoutStep === "details" && (
                                <button 
                                    onClick={() => handleRemoveClick(item)}
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
                        disabled={checkoutStep !== "details"}
                    />
                    <Button variant="outline" disabled={checkoutStep !== "details"}>Apply</Button>
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

              {/* Checkout step indicator */}
              <Separator />
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${checkoutStep === "details" ? "bg-primary" : "bg-green-500"}`} />
                  <span className={checkoutStep !== "details" ? "text-green-600" : ""}>
                    {checkoutStep !== "details" ? "Contact info complete" : "Fill in contact info"}
                  </span>
                </div>
                {requiredWaivers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${checkoutStep === "waivers" ? "bg-primary" : checkoutStep === "payment" ? "bg-green-500" : "bg-muted"}`} />
                    <span className={checkoutStep === "payment" ? "text-green-600" : ""}>
                      {checkoutStep === "payment" ? "Waivers signed" : "Sign required waivers"}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${checkoutStep === "payment" ? "bg-primary" : "bg-muted"}`} />
                  <span>Complete payment</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Reservation Timer */}
      {hasReservation && reservation && (
        <ReservationTimer 
          expiresAt={reservation.expiresAt} 
          organizationSlug={params.slug}
        />
      )}
      
      {/* Remove item confirmation dialog */}
      <RemoveItemDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        itemToRemove={itemToRemove}
        dependentItems={dependentItems}
        onCancel={handleCancelRemove}
        onConfirmRemove={handleConfirmRemove}
      />
    </div>
  )
}
