"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CreditCard, Loader2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { toast } from "sonner";
import { AdyenCheckoutComponent } from "@/components/sites/adyen-checkout";

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
  sportIds?: string[];
  planId: string;
  planName: string;
  planPrice: string | number;
}

export default function PaymentPage() {
  const router = useRouter();
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [paymentSession, setPaymentSession] = useState<{ id: string; sessionData: string } | null>(
    null
  );
  const [shopperReference, setShopperReference] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(true);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

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
    createSession(data);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createSession = async (data: SignupData) => {
    setIsCreatingSession(true);
    setSessionError(null);
    try {
      const signupReference = `${data.subdomain}-${Date.now()}`;
      const response = await fetch("/api/org-signup/payment-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupReference,
          email: data.email || data.orgEmail,
          returnUrl: `${window.location.origin}/org-signup/payment`,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create payment session");
      }

      const sessionData = await response.json();
      setPaymentSession({ id: sessionData.sessionId, sessionData: sessionData.sessionData });
      setShopperReference(sessionData.shopperReference);
    } catch (error: any) {
      console.error("Failed to create payment session:", error);
      setSessionError(error.message || "Failed to initialize payment. Please try again.");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handlePaymentCompleted = async (result: any) => {
    if (
      result.resultCode !== "Authorised" &&
      result.resultCode !== "Pending" &&
      result.resultCode !== "Received"
    ) {
      toast.error(`Payment was not successful (${result.resultCode}). Please try again.`);
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmStartTrial = async () => {
    if (!signupData) return;

    setIsCreatingOrg(true);
    try {
      const { confirmPassword, planName, planPrice, ...formFields } = signupData;

      const response = await fetch("/api/org-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formFields,
          adyenShopperReference: shopperReference,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create organization");
      }

      sessionStorage.removeItem("org-signup-data");
      const successParams = new URLSearchParams({
        subdomain: signupData.subdomain,
        orgName: signupData.orgName,
        orgId: data.organizationId,
        planPrice: String(signupData.planPrice),
      });
      router.push(`/org-signup/success?${successParams.toString()}`);
    } catch (error: any) {
      console.error("Failed to create organization:", error);
      toast.error(error.message || "Organization creation failed. Please contact support.");
      setIsCreatingOrg(false);
    }
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
              <Badge variant="secondary">30-day free trial</Badge>
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
                Your 30-day free trial starts when you confirm. After your trial ends on{" "}
                <span className="font-medium text-foreground">{formattedTrialEnd}</span>,
                you&apos;ll be billed ${monthlyPrice.toFixed(2)}/month. Cancel anytime from your
                dashboard.
              </p>
            </div>
          </CardContent>
        </Card>

        {showConfirmation ? (
          /* Confirmation Step */
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Confirm Your Trial</CardTitle>
                  <CardDescription>
                    Your payment method has been saved. Review and confirm to start.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="font-medium">{signupData.orgName}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{signupData.planName}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Due today</span>
                  <span className="font-semibold text-green-600">$0.00</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">After trial ({formattedTrialEnd})</span>
                  <span className="font-medium">${monthlyPrice.toFixed(2)}/mo</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                onClick={handleConfirmStartTrial}
                disabled={isCreatingOrg}
                className="w-full"
                size="lg"
              >
                {isCreatingOrg ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating your organization...
                  </>
                ) : (
                  "Start Free Trial"
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By confirming, you agree to be billed ${monthlyPrice.toFixed(2)}/month after your
                30-day trial.
              </p>
            </CardFooter>
          </Card>
        ) : (
          /* Payment Form */
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
              {isCreatingSession ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading payment form...</p>
                </div>
              ) : sessionError ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <p className="text-sm text-destructive">{sessionError}</p>
                  <Button variant="outline" onClick={() => createSession(signupData)}>
                    Try Again
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

        {!showConfirmation && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/org-signup">Back to Signup</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
