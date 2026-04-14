"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CreditCard, Loader2, MapPin, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StateProvinceCombobox } from "@/components/ui/state-province-combobox";
import Link from "next/link";
import { toast } from "sonner";
import { AdyenCheckoutComponent } from "@/components/sites/adyen-checkout";
import { FREE_TRIAL_DAYS } from "@/lib/billing-config";

interface SignupData {
  useExistingAccount?: boolean;
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  orgName: string;
  orgEmail: string;
  phone: string;
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  subdomain: string;
  primaryColor?: string;
  secondaryColor?: string;
  planId: string;
  planName: string;
  planPrice: string | number;
}

interface BillingAddress {
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [paymentSession, setPaymentSession] = useState<{ id: string; sessionData: string } | null>(
    null
  );
  const [shopperReference, setShopperReference] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [cardSaved, setCardSaved] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const fetchCardDetailsPromiseRef = useRef<Promise<void> | null>(null);

  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    street: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "US",
  });
  const [useSameAddress, setUseSameAddress] = useState(true);
  const [billingAddressConfirmed, setBillingAddressConfirmed] = useState(false);
  const [billingErrors, setBillingErrors] = useState<Partial<Record<keyof BillingAddress, string>>>(
    {}
  );

  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 30);
  const formattedTrialEnd = trialEndDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    const raw = sessionStorage.getItem("org-signup-data");
    if (!raw) {
      router.replace("/org-signup");
      return;
    }

    let data: SignupData;
    try {
      data = JSON.parse(raw);
    } catch {
      router.replace("/org-signup");
      return;
    }

    if ((!data.email && !data.useExistingAccount) || !data.subdomain || !data.planId) {
      router.replace("/org-signup");
      return;
    }

    setSignupData(data);
    setBillingAddress({
      street: data.street ?? "",
      city: data.city ?? "",
      stateProvince: data.stateProvince ?? "",
      postalCode: data.postalCode ?? "",
      country: "US",
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createSession = async (addr: BillingAddress): Promise<boolean> => {
    if (!signupData) return false;
    setIsCreatingSession(true);
    setSessionError(null);
    try {
      const signupReference = `${signupData.subdomain}-${Date.now()}`;
      const response = await fetch("/api/org-signup/payment-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupReference,
          email: signupData.email || signupData.orgEmail,
          returnUrl: `${window.location.origin}/org-signup/payment`,
          billingAddress: {
            street: addr.street,
            city: addr.city,
            stateOrProvince: addr.stateProvince,
            postalCode: addr.postalCode,
            country: addr.country,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create payment session");
      }

      const sessionData = await response.json();
      setPaymentSession({ id: sessionData.sessionId, sessionData: sessionData.sessionData });
      setShopperReference(sessionData.shopperReference);
      return true;
    } catch (error: any) {
      console.error("Failed to create payment session:", error);
      setSessionError(error.message || "Failed to initialize payment. Please try again.");
      return false;
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleUseSameAddressChange = (checked: boolean) => {
    setUseSameAddress(checked);
    setBillingErrors({});
    if (checked && signupData) {
      setBillingAddress({
        street: signupData.street ?? "",
        city: signupData.city ?? "",
        stateProvince: signupData.stateProvince ?? "",
        postalCode: signupData.postalCode ?? "",
        country: "US",
      });
    } else {
      setBillingAddress({
        street: "",
        city: "",
        stateProvince: "",
        postalCode: "",
        country: "US",
      });
    }
  };

  const handleContinueToPayment = async () => {
    const errs: Partial<Record<keyof BillingAddress, string>> = {};
    if (!billingAddress.street.trim()) errs.street = "Street is required";
    if (!billingAddress.city.trim()) errs.city = "City is required";
    if (!billingAddress.stateProvince.trim()) errs.stateProvince = "State/Province is required";
    if (!billingAddress.postalCode.trim()) errs.postalCode = "Postal code is required";
    if (Object.keys(errs).length > 0) {
      setBillingErrors(errs);
      return;
    }
    setBillingErrors({});
    const success = await createSession(billingAddress);
    if (success) setBillingAddressConfirmed(true);
  };

  const fetchAndStoreCardDetails = async (ref: string): Promise<void> => {
    try {
      const response = await fetch(
        `/api/org-signup/stored-payment-method?shopperReference=${encodeURIComponent(ref)}`
      );
      if (!response.ok) return;
      const { lastFour, brand } = await response.json();
      if (!lastFour) return;
      const existing = sessionStorage.getItem("org-signup-data");
      let existingData = {};
      try {
        existingData = existing ? JSON.parse(existing) : {};
      } catch {}
      sessionStorage.setItem(
        "org-signup-data",
        JSON.stringify({ ...existingData, cardLastFour: lastFour, cardBrand: brand })
      );
    } catch {
      // non-fatal — review page falls back to "Saved"
    }
  };

  const handlePaymentCompleted = (result: any) => {
    if (
      result.resultCode !== "Authorised" &&
      result.resultCode !== "Pending" &&
      result.resultCode !== "Received"
    ) {
      toast.error(`Payment was not successful (${result.resultCode}). Please try again.`);
      return;
    }

    const existing = sessionStorage.getItem("org-signup-data");
    let existingData = {};
    try {
      existingData = existing ? JSON.parse(existing) : {};
    } catch (e: unknown) {
      console.error(e);
    }
    sessionStorage.setItem(
      "org-signup-data",
      JSON.stringify({ ...existingData, adyenShopperReference: shopperReference })
    );

    if (shopperReference) {
      fetchCardDetailsPromiseRef.current = fetchAndStoreCardDetails(shopperReference);
    }

    setCardSaved(true);
  };

  const handleContinueToReview = async () => {
    setIsContinuing(true);
    await fetchCardDetailsPromiseRef.current;
    router.push("/org-signup/review");
  };

  const handlePaymentError = (error: any) => {
    console.error("Payment error:", error);
    toast.error("Payment failed. Please try again.");
  };

  if (!signupData) {
    return (
      <div className="w-full max-w-lg mx-auto flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const monthlyPrice = Number(signupData.planPrice);

  const disabled =
    isCreatingSession ||
    !billingAddress.street.trim() ||
    !billingAddress.city.trim() ||
    !billingAddress.stateProvince.trim() ||
    billingAddress.postalCode.length < 5;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Link
        href="/org-signup"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to signup
      </Link>

      <div className="grid gap-6">
        {/* Plan Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Plan Summary</CardTitle>
              <Badge variant="secondary">{FREE_TRIAL_DAYS}-day free trial</Badge>
            </div>
            <CardDescription>
              Setting up <span className="font-medium text-foreground">{signupData.orgName}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{signupData.planName} Plan</p>
                <p className="text-sm text-muted-foreground">Monthly subscription</p>
              </div>
              <p className="text-lg font-semibold">
                ${monthlyPrice.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
            </div>
            <Separator />
            <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-primary" />
                You won&apos;t be charged today
              </div>
              <p className="text-xs text-muted-foreground">
                Your {FREE_TRIAL_DAYS}-day free trial starts when you confirm. After your trial ends
                on <span className="font-medium text-foreground">{formattedTrialEnd}</span>,
                you&apos;ll be billed ${monthlyPrice.toFixed(2)}/month. Cancel anytime from your
                dashboard.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Billing Address</CardTitle>
            </div>
            <CardDescription>
              This address will be associated with your payment method.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {billingAddressConfirmed ? (
              <div className="flex items-center gap-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {billingAddress.street}, {billingAddress.city}, {billingAddress.stateProvince}{" "}
                  {billingAddress.postalCode}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="use-same-address"
                    checked={useSameAddress}
                    onCheckedChange={(checked) => handleUseSameAddressChange(!!checked)}
                  />
                  <Label htmlFor="use-same-address" className="font-normal cursor-pointer">
                    Use same address as my organization
                  </Label>
                </div>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-street">Street Address</Label>
                    <Input
                      id="billing-street"
                      value={billingAddress.street}
                      onChange={(e) => {
                        setBillingAddress((prev) => ({ ...prev, street: e.target.value }));
                        if (billingErrors.street)
                          setBillingErrors((prev) => ({ ...prev, street: "" }));
                      }}
                      disabled={useSameAddress}
                      autoComplete="street-address"
                      className={billingErrors.street ? "border-destructive" : ""}
                    />
                    {billingErrors.street && (
                      <p className="text-sm text-destructive">{billingErrors.street}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-city">City</Label>
                      <Input
                        id="billing-city"
                        value={billingAddress.city}
                        onChange={(e) => {
                          setBillingAddress((prev) => ({
                            ...prev,
                            city: e.target.value.replace(/[0-9]/g, ""),
                          }));
                          if (billingErrors.city)
                            setBillingErrors((prev) => ({ ...prev, city: "" }));
                        }}
                        disabled={useSameAddress}
                        autoComplete="address-level2"
                        className={billingErrors.city ? "border-destructive" : ""}
                      />
                      {billingErrors.city && (
                        <p className="text-sm text-destructive">{billingErrors.city}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="billing-postal">Postal Code</Label>
                      <Input
                        id="billing-postal"
                        value={billingAddress.postalCode}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setBillingAddress((prev) => ({ ...prev, postalCode: digits }));
                          if (billingErrors.postalCode)
                            setBillingErrors((prev) => ({ ...prev, postalCode: "" }));
                        }}
                        disabled={useSameAddress}
                        autoComplete="postal-code"
                        className={billingErrors.postalCode ? "border-destructive" : ""}
                      />
                      {billingErrors.postalCode && (
                        <p className="text-sm text-destructive">{billingErrors.postalCode}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>State</Label>
                    <StateProvinceCombobox
                      country="US"
                      value={billingAddress.stateProvince}
                      onChange={(value) => {
                        setBillingAddress((prev) => ({ ...prev, stateProvince: value }));
                        if (billingErrors.stateProvince)
                          setBillingErrors((prev) => ({ ...prev, stateProvince: "" }));
                      }}
                      disabled={useSameAddress}
                      error={!!billingErrors.stateProvince}
                    />
                    {billingErrors.stateProvince && (
                      <p className="text-sm text-destructive">{billingErrors.stateProvince}</p>
                    )}
                  </div>
                </div>
                {sessionError && <p className="text-sm text-destructive">{sessionError}</p>}
                <Button className="w-full" onClick={handleContinueToPayment} disabled={disabled}>
                  {isCreatingSession ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Setting up payment...
                    </>
                  ) : (
                    "Continue to Payment"
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        {billingAddressConfirmed && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Payment Method</CardTitle>
              </div>
              <CardDescription>
                Add a payment method for billing after your free trial. You will not be charged
                today.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cardSaved ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Payment method saved</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You won&apos;t be charged until your trial ends on {formattedTrialEnd}.
                    </p>
                  </div>
                  <Button
                    className="mt-2 w-full"
                    size="lg"
                    onClick={handleContinueToReview}
                    disabled={isContinuing}
                  >
                    {isContinuing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Continue to Review"
                    )}
                  </Button>
                </div>
              ) : paymentSession ? (
                <AdyenCheckoutComponent
                  sessionId={paymentSession.id}
                  sessionData={paymentSession.sessionData}
                  onPaymentCompleted={handlePaymentCompleted}
                  onError={handlePaymentError}
                />
              ) : null}
            </CardContent>
          </Card>
        )}

        {!cardSaved && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/org-signup">Back to Signup</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
