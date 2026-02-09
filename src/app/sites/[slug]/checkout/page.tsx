"use client"

import { useState, useEffect, useRef } from "react"
import { useCart, CartItem } from "@/components/sites/cart-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, Trash2, FileText, Check, ChevronRight, ChevronLeft, User, Heart, AlertCircle } from "lucide-react"
import Link from "next/link"
import { AdyenCheckoutComponent } from "@/components/sites/adyen-checkout"
import { SignaturePad, SignaturePadRef } from "@/components/ui/signature-pad"
import { CheckoutMedicalForm } from "@/components/sites/checkout-medical-form"
import { toast } from "sonner"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQueueGate, useCompleteRegistration } from "@/hooks/use-queue-gate"
import { ReservationTimer } from "@/components/sites/reservation-timer"
import { RemoveItemDialog } from "@/components/sites/remove-item-dialog"
import type { MedicalFormConfig, CustomMedicalQuestion } from "@/types/medical"

type CheckoutStep = "details" | "waivers" | "medical" | "payment"

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

interface AthleteRequirements {
  athleteId: string
  athleteName: string
  requiredWaiverIds: string[]
  needsMedical: boolean
}

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const { items, subtotal, removeItem, clearCart, getDependentItems, removeItemWithDependents, getItemsByAthlete } = useCart()
  const router = useRouter()
  const { data: session } = useSession()
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

  // Pre-fill contact info from session when available
  useEffect(() => {
    if (session?.user) {
      setFormData((prev) => {
        // Only pre-fill empty fields to avoid overwriting user edits
        const nameParts = (session.user?.name || "").split(" ")
        return {
          ...prev,
          firstName: prev.firstName || nameParts[0] || "",
          lastName: prev.lastName || nameParts.slice(1).join(" ") || "",
          email: prev.email || session.user?.email || "",
        }
      })
    }
  }, [session])
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

  // Medical state
  const [medicalConfig, setMedicalConfig] = useState<MedicalFormConfig | null>(null)
  const [medicalCustomQuestions, setMedicalCustomQuestions] = useState<CustomMedicalQuestion[]>([])

  // Per-athlete requirements flow
  const [athleteQueue, setAthleteQueue] = useState<AthleteRequirements[]>([])
  const [currentAthleteIndex, setCurrentAthleteIndex] = useState(0)
  const [athleteWaiverComplete, setAthleteWaiverComplete] = useState<Set<string>>(new Set())
  const [athleteMedicalComplete, setAthleteMedicalComplete] = useState<Set<string>>(new Set())
  // Track signed waivers per athlete: Map<athleteId, Set<waiverId>>
  const signedWaiverIdsRef = useRef<Map<string, Set<string>>>(new Map())
  const athleteQueueRef = useRef<AthleteRequirements[]>([])
  const organizationIdRef = useRef<string | null>(null)

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

  // Process per-athlete requirements starting from the given index
  // Iterates through the queue, showing waivers/medical as needed per athlete
  const advanceToNextRequirement = async (startIndex: number) => {
    const queue = athleteQueueRef.current
    const orgId = organizationIdRef.current

    for (let i = startIndex; i < queue.length; i++) {
      const athlete = queue[i]
      setCurrentAthleteIndex(i)

      // Check unsigned waivers for this specific athlete
      const athleteSigned = signedWaiverIdsRef.current.get(athlete.athleteId) || new Set()
      const unsignedIds = athlete.requiredWaiverIds.filter(
        (id) => !athleteSigned.has(id)
      )

      if (unsignedIds.length > 0 && orgId) {
        // Verify with server which are actually unsigned
        const checkResponse = await fetch("/api/public/waivers/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            waiverIds: unsignedIds,
            organizationId: orgId,
            athleteId: athlete.athleteId,
          }),
        })

        if (!checkResponse.ok) {
          throw new Error("Failed to check waiver status")
        }

        const checkData = await checkResponse.json()
        setFamilyId(checkData.familyId)

        // Update local signed set with server data (per athlete)
        if (!signedWaiverIdsRef.current.has(athlete.athleteId)) {
          signedWaiverIdsRef.current.set(athlete.athleteId, new Set())
        }
        const athleteSignedSet = signedWaiverIdsRef.current.get(athlete.athleteId)!
        checkData.data.forEach((w: WaiverToSign) => {
          if (w.isSigned) athleteSignedSet.add(w.waiverId)
        })

        const stillUnsigned = checkData.data.filter((w: WaiverToSign) => !w.isSigned)

        if (stillUnsigned.length > 0) {
          // Show waiver signing step for this athlete
          setRequiredWaivers(stillUnsigned)
          setCurrentWaiverIndex(0)
          setCheckoutStep("waivers")
          setSignAllMode(false)
          signaturePadRef.current?.clear()
          setSignatureEmpty(true)
          await loadWaiverContent(stillUnsigned[0].waiverId, orgId)
          return // Exit — waiver step shown, flow continues after signing
        }
      }

      // All waivers for this athlete are done
      setAthleteWaiverComplete((prev) => {
        const next = new Set(prev)
        next.add(athlete.athleteId)
        return next
      })

      // Check medical
      if (athlete.needsMedical) {
        setCheckoutStep("medical")
        return // Exit — medical step shown, flow continues after completion
      }

      // No medical needed — mark complete and continue to next athlete
      setAthleteMedicalComplete((prev) => {
        const next = new Set(prev)
        next.add(athlete.athleteId)
        return next
      })
    }

    // All athletes processed — proceed to payment
    await createPaymentSession()
  }

  // Check for per-athlete requirements (waivers + medical) and proceed accordingly
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
        organizationIdRef.current = orgId
      }

      if (!orgId) {
        toast.error("Unable to determine organization. Please try again.")
        return
      }

      // Collect program items from cart
      const programItems = items.filter((item) => item.type === "program")
      const programIds = programItems
        .map((item) => item.details?.programId || item.referenceId)
        .filter(Boolean)

      if (programIds.length === 0) {
        // No programs — go straight to payment
        await createPaymentSession()
        return
      }

      // Fetch waiver and medical requirements in parallel
      const [waiverResponse, medicalResponse] = await Promise.all([
        fetch(`/api/public/programs/waiver-requirements?programIds=${programIds.join(",")}&organizationId=${orgId}`),
        fetch(`/api/public/programs/medical-requirements?programIds=${programIds.join(",")}&organizationId=${orgId}`),
      ])

      let programWaiverMap: Record<string, string[]> = {}
      if (waiverResponse.ok) {
        const waiverData = await waiverResponse.json()
        programWaiverMap = waiverData.programWaiverMap || {}
      }

      let programIdsRequiringMedical: string[] = []
      if (medicalResponse.ok) {
        const medData = await medicalResponse.json()
        if (medData.required && medData.config) {
          programIdsRequiringMedical = medData.programIdsRequiringMedical || []
          setMedicalConfig(medData.config)
          setMedicalCustomQuestions(medData.customQuestions || [])
        }
      }

      // Build per-athlete requirements queue
      const athleteMap = new Map<string, { athleteName: string; programIds: string[] }>()
      programItems.forEach((item) => {
        const programId = item.details?.programId || item.referenceId
        if (!programId || !item.athleteId) return
        const existing = athleteMap.get(item.athleteId) || { athleteName: item.athleteName, programIds: [] }
        if (!existing.programIds.includes(programId)) {
          existing.programIds.push(programId)
        }
        athleteMap.set(item.athleteId, existing)
      })

      const queue: AthleteRequirements[] = Array.from(athleteMap.entries()).map(
        ([athleteId, { athleteName, programIds: athleteProgramIds }]) => {
          // Compute required waiver IDs for this athlete's programs
          const waiverIdSet = new Set<string>()
          athleteProgramIds.forEach((pid) => {
            const waiverIds = programWaiverMap[pid] || []
            waiverIds.forEach((wid) => waiverIdSet.add(wid))
          })

          // Check if any of this athlete's programs need medical
          const needsMedical = athleteProgramIds.some((pid) => programIdsRequiringMedical.includes(pid))

          return {
            athleteId,
            athleteName,
            requiredWaiverIds: Array.from(waiverIdSet),
            needsMedical,
          }
        }
      )

      // Store queue in both state and ref
      setAthleteQueue(queue)
      athleteQueueRef.current = queue
      signedWaiverIdsRef.current = new Map()

      // If no requirements at all, go straight to payment
      if (queue.length === 0 || queue.every((a) => a.requiredWaiverIds.length === 0 && !a.needsMedical)) {
        await createPaymentSession()
        return
      }

      // Start processing from the first athlete
      await advanceToNextRequirement(0)
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

      const currentAthlete = athleteQueueRef.current[currentAthleteIndex]

      const response = await fetch(`/api/public/waivers/${currentWaiver.waiverId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organizationIdRef.current,
          familyId,
          athleteId: currentAthlete?.athleteId || null,
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
        // This waiver is complete - move to next waiver or check medical/payment
        toast.success(`"${currentWaiver.waiverTitle}" signed successfully`)
        
        if (currentWaiverIndex < requiredWaivers.length - 1) {
          const nextIndex = currentWaiverIndex + 1
          setCurrentWaiverIndex(nextIndex)
          setSignAllMode(false)
          signaturePadRef.current?.clear()
          setSignatureEmpty(true)
          await loadWaiverContent(requiredWaivers[nextIndex].waiverId, organizationIdRef.current!)
        } else {
          // All waivers for this athlete signed
          const currentAthlete = athleteQueueRef.current[currentAthleteIndex]
          if (currentAthlete) {
            // Track all of this athlete's required waivers as signed (per athlete)
            if (!signedWaiverIdsRef.current.has(currentAthlete.athleteId)) {
              signedWaiverIdsRef.current.set(currentAthlete.athleteId, new Set())
            }
            const signedSet = signedWaiverIdsRef.current.get(currentAthlete.athleteId)!
            currentAthlete.requiredWaiverIds.forEach((id) => signedSet.add(id))
            setAthleteWaiverComplete((prev) => {
              const next = new Set(prev)
              next.add(currentAthlete.athleteId)
              return next
            })

            if (currentAthlete.needsMedical) {
              setCheckoutStep("medical")
            } else {
              setAthleteMedicalComplete((prev) => {
                const next = new Set(prev)
                next.add(currentAthlete.athleteId)
                return next
              })
              await advanceToNextRequirement(currentAthleteIndex + 1)
            }
          }
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
                        Continue
                        <ChevronRight className="ml-1 h-4 w-4" />
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
                  {athleteQueue.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      — for {athleteQueue[currentAthleteIndex]?.athleteName}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Please review and sign the following waiver{requiredWaivers.length > 1 ? "s" : ""} before proceeding.
                  {requiredWaivers.length > 1 && (
                    <span className="block mt-1">
                      Waiver {currentWaiverIndex + 1} of {requiredWaivers.length}: <strong>{requiredWaivers[currentWaiverIndex]?.waiverTitle}</strong>
                    </span>
                  )}
                  {athleteQueue.length > 1 && (
                    <span className="block mt-1 text-xs">
                      Athlete {currentAthleteIndex + 1} of {athleteQueue.length}
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
                        : "Sign & Continue"
                  )}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Medical Information Step */}
          {checkoutStep === "medical" && medicalConfig && athleteQueue.length > 0 && (
            <>
              {athleteQueue.length > 1 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <span>
                    Athlete {currentAthleteIndex + 1} of {athleteQueue.length}
                  </span>
                </div>
              )}
              <CheckoutMedicalForm
                key={athleteQueue[currentAthleteIndex]?.athleteId}
                athleteId={athleteQueue[currentAthleteIndex]?.athleteId}
                athleteName={athleteQueue[currentAthleteIndex]?.athleteName}
                config={medicalConfig}
                customQuestions={medicalCustomQuestions}
                organizationId={organizationId!}
                email={formData.email}
                onComplete={async () => {
                  const currentAthlete = athleteQueueRef.current[currentAthleteIndex]
                  // Mark this athlete's medical as complete
                  setAthleteMedicalComplete((prev) => {
                    const next = new Set(prev)
                    next.add(currentAthlete.athleteId)
                    return next
                  })

                  // Advance to next athlete or payment
                  setIsProcessing(true)
                  try {
                    await advanceToNextRequirement(currentAthleteIndex + 1)
                  } finally {
                    setIsProcessing(false)
                  }
                }}
                onBack={() => {
                  // Go back to details — signed waivers and saved medical info persist server-side
                  setCheckoutStep("details")
                }}
              />
            </>
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
                {Array.from(getItemsByAthlete().entries()).map(([athleteId, { athleteName, items: athleteItems }]) => (
                  <div key={athleteId}>
                    {/* Athlete section header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary">
                        <User className="h-3 w-3" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{athleteName}</span>
                      {/* Requirement status indicators */}
                      {checkoutStep !== "details" && (() => {
                        const reqs = athleteQueue.find((a) => a.athleteId === athleteId)
                        if (!reqs) return null
                        return (
                          <>
                            {reqs.requiredWaiverIds.length > 0 && (
                              athleteWaiverComplete.has(athleteId) ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 dark:bg-green-950/50 px-1.5 py-0.5 rounded-full">
                                  <Check className="h-2.5 w-2.5" />
                                  Waivers
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-full">
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  Waivers
                                </span>
                              )
                            )}
                            {reqs.needsMedical && (
                              athleteMedicalComplete.has(athleteId) ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 dark:bg-green-950/50 px-1.5 py-0.5 rounded-full">
                                  <Check className="h-2.5 w-2.5" />
                                  Medical
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-full">
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  Medical
                                </span>
                              )
                            )}
                          </>
                        )
                      })()}
                    </div>
                    <div className="space-y-2 pl-2 mb-3">
                      {athleteItems.map((item) => (
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
                {athleteQueue.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      checkoutStep === "payment" ? "bg-green-500"
                      : (checkoutStep === "waivers" || checkoutStep === "medical") ? "bg-primary"
                      : "bg-muted"
                    }`} />
                    <span className={checkoutStep === "payment" ? "text-green-600" : ""}>
                      {checkoutStep === "payment"
                        ? "All requirements complete"
                        : (checkoutStep === "waivers" || checkoutStep === "medical")
                          ? `Athlete requirements (${currentAthleteIndex + 1}/${athleteQueue.length})`
                          : "Complete requirements"}
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
