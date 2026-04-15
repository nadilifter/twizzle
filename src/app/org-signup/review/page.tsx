"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, CreditCard, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { toast } from "sonner";
import { getBaseDomainSuffix } from "@/lib/client-domains";
import { getPendingPassword, clearPendingPassword } from "@/lib/pending-password";
import { formatCardBrand } from "@/lib/payment-utils";
import { FREE_TRIAL_DAYS } from "@/lib/billing-config";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import { DevTrialBillingTester } from "./dev-trial-billing-tester";
import { SmsConsentCheckbox } from "@/components/sms-consent-checkbox";

interface SignupData {
  useExistingAccount?: boolean;
  email?: string;
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
  adyenShopperReference?: string;
  cardLastFour?: string | null;
  cardBrand?: string | null;
}

const isDevEnv =
  process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "local" ||
  process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "development";

export default function ReviewPage() {
  const router = useRouter();
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [runCronAfterCreation, setRunCronAfterCreation] = useState(false);
  // Standalone SMS opt-in (Twilio TFV 30475 — must not gate submission)
  const [smsConsent, setSmsConsent] = useState(false);
  const [pendingCron, setPendingCron] = useState<{ orgId: string; successUrl: string } | null>(
    null
  );

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

    if (!data.subdomain || !data.planId) {
      router.replace("/org-signup");
      return;
    }

    setSignupData(data);
  }, [router]);

  const handleCreateOrganization = async () => {
    if (!signupData) return;

    setIsCreatingOrg(true);
    try {
      const { planName, planPrice, cardLastFour, cardBrand, ...formFields } = signupData;

      const password = getPendingPassword();
      if (!signupData.useExistingAccount && !password) {
        toast.error("Session expired. Please restart the signup process.");
        router.replace("/org-signup");
        return;
      }

      const response = await fetch("/api/org-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formFields,
          ...(password ? { password } : {}),
          runCronAfterCreation,
          // Don't send consent on the existing-account path — the backend
          // ignores it there, but sending it invites silent regressions if
          // the backend suppression is ever refactored. Existing users opt
          // in via /athletes/account.
          ...(formFields.useExistingAccount ? {} : { smsConsent }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create organization");
      }

      sessionStorage.removeItem("org-signup-data");
      clearPendingPassword();
      const successParams = new URLSearchParams({
        subdomain: signupData.subdomain,
        orgName: signupData.orgName,
        orgId: data.organizationId,
        planPrice: String(signupData.planPrice),
      });
      const successUrl = `/org-signup/success?${successParams.toString()}`;

      if (runCronAfterCreation) {
        setIsCreatingOrg(false);
        setPendingCron({ orgId: data.organizationId, successUrl });
        return;
      }

      router.push(successUrl);
    } catch (error: any) {
      toast.error(error.message || "Organization creation failed. Please contact support.");
      setIsCreatingOrg(false);
    }
  };

  if (!signupData) {
    return (
      <div className="w-full max-w-lg mx-auto flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPaidPlan = Number(signupData.planPrice) > 0;
  const monthlyPrice = Number(signupData.planPrice);

  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 30);
  const formattedTrialEnd = trialEndDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const locationParts = [signupData.city, signupData.stateProvince, signupData.country].filter(
    Boolean
  );
  const location = locationParts.join(", ");

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Link
        href={isPaidPlan ? "/org-signup/payment" : "/org-signup"}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Review Your Organization</h1>
        <p className="text-muted-foreground">
          Everything look right? Go ahead and create your organization.
        </p>
      </div>

      <div className="grid gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{signupData.orgName}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Website</span>
              <span className="font-medium">
                {signupData.subdomain}
                {getBaseDomainSuffix()}
              </span>
            </div>
            {signupData.orgEmail && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{signupData.orgEmail}</span>
                </div>
              </>
            )}
            {signupData.phone && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">
                    {formatPhoneNumberIntl(signupData.phone) || signupData.phone}
                  </span>
                </div>
              </>
            )}
            {location && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{location}</span>
                </div>
              </>
            )}
            {(signupData.primaryColor || signupData.secondaryColor) && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Brand Colors</span>
                  <div className="flex items-center gap-2">
                    {signupData.primaryColor && (
                      <div
                        className="h-5 w-5 rounded-full border border-border"
                        style={{ backgroundColor: signupData.primaryColor }}
                        title={`Primary: ${signupData.primaryColor}`}
                      />
                    )}
                    {signupData.secondaryColor && (
                      <div
                        className="h-5 w-5 rounded-full border border-border"
                        style={{ backgroundColor: signupData.secondaryColor }}
                        title={`Secondary: ${signupData.secondaryColor}`}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{signupData.planName}</span>
                {isPaidPlan ? (
                  <span className="text-muted-foreground">${monthlyPrice.toFixed(0)}/mo</span>
                ) : null}
              </div>
            </div>
            {isPaidPlan && (
              <>
                <Separator />
                <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="h-4 w-4 text-primary" />
                    You won&apos;t be charged today
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your {FREE_TRIAL_DAYS}-day free trial starts when you confirm. After your trial
                    ends on <span className="font-medium text-foreground">{formattedTrialEnd}</span>
                    , you&apos;ll be billed ${monthlyPrice.toFixed(2)}/month.
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payment method</span>
                  {signupData.cardLastFour ? (
                    <span className="font-medium capitalize">
                      {signupData.cardBrand ? `${formatCardBrand(signupData.cardBrand)} ` : ""}
                      &bull;&bull;&bull;&bull; {signupData.cardLastFour}
                    </span>
                  ) : (
                    <span className="font-medium text-muted-foreground">Saved</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {isDevEnv && isPaidPlan && (
        <DevTrialBillingTester
          runCronAfterCreation={runCronAfterCreation}
          onToggle={setRunCronAfterCreation}
          pendingCron={pendingCron}
        />
      )}

      <div className="mb-4">
        <SmsConsentCheckbox
          checked={smsConsent}
          onChange={setSmsConsent}
          disabled={isCreatingOrg || !!pendingCron}
        />
      </div>

      <Button
        onClick={handleCreateOrganization}
        disabled={isCreatingOrg || !!pendingCron}
        className="w-full"
        size="lg"
      >
        {isCreatingOrg ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating your organization...
          </>
        ) : (
          "Create Organization"
        )}
      </Button>

      {isPaidPlan && (
        <p className="text-xs text-center text-muted-foreground mt-3">
          By creating your organization, you agree to be billed ${monthlyPrice.toFixed(2)}/month
          after your {FREE_TRIAL_DAYS}-day trial ends on {formattedTrialEnd}.
        </p>
      )}
    </div>
  );
}
