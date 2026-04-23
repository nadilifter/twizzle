"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLinkIcon,
  Loader2,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  PencilIcon,
} from "lucide-react";

import { OrganizationAddressForm } from "@/components/organization-address-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defineStepper,
  getStepStatus,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
} from "@/components/ui/stepper";
import { cn } from "@/lib/utils";

export type OnboardingStepperOrganization = {
  id: string;
  name: string;
  email?: string | null;
  street: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  onboardingLegalNameConfirmedAt: string | null;
  onboardingFeeAcknowledgedAt: string | null;
  onboardingAgreementAcceptedAt: string | null;
};

export type OnboardingStepperPlan = {
  transactionFee: string | number;
  perTransactionFee: string | number;
} | null;

const { useStepper } = defineStepper(
  { id: "org-details", title: "Organization" },
  { id: "legal-name", title: "Legal Name" },
  { id: "fee-disclosure", title: "Fees" },
  { id: "platform-agreement", title: "Agreement" },
  { id: "review", title: "Review" }
);

type StepId = "org-details" | "legal-name" | "fee-disclosure" | "platform-agreement" | "review";
const STEP_IDS: StepId[] = [
  "org-details",
  "legal-name",
  "fee-disclosure",
  "platform-agreement",
  "review",
];

function isOrgAddressComplete(org: OnboardingStepperOrganization): boolean {
  return Boolean(
    org.street && org.city && org.stateProvince && org.postalCode && org.country && org.phone
  );
}

function computeCompletedSteps(org: OnboardingStepperOrganization): Record<StepId, boolean> {
  return {
    "org-details": isOrgAddressComplete(org),
    "legal-name": !!org.onboardingLegalNameConfirmedAt,
    "fee-disclosure": !!org.onboardingFeeAcknowledgedAt,
    "platform-agreement": !!org.onboardingAgreementAcceptedAt,
    review: false,
  };
}

export function firstIncompleteStep(org: OnboardingStepperOrganization): StepId {
  const completed = computeCompletedSteps(org);
  for (const id of STEP_IDS) {
    if (id === "review") return "review";
    if (!completed[id]) return id;
  }
  return "review";
}

type OnboardingStepperProps = {
  organization: OnboardingStepperOrganization;
  plan: OnboardingStepperPlan;
  onOrganizationUpdate: (org: OnboardingStepperOrganization) => void;
  onInitiateAndRedirect: () => Promise<void>;
  initiateLoading: boolean;
};

export function OnboardingStepper({
  organization,
  plan,
  onOrganizationUpdate,
  onInitiateAndRedirect,
  initiateLoading,
}: OnboardingStepperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepper = useStepper();

  const completed = useMemo(() => computeCompletedSteps(organization), [organization]);

  const currentIndex = stepper.state.all.findIndex((s) => s.id === stepper.state.current.data.id);
  const currentStepId = stepper.state.current.data.id as StepId;

  useEffect(() => {
    const urlStep = searchParams.get("step") as StepId | null;
    if (!urlStep || !STEP_IDS.includes(urlStep)) return;
    if (urlStep === stepper.state.current.data.id) return;

    // Guard: don't allow jumping forward past incomplete prior steps
    const targetIndex = STEP_IDS.indexOf(urlStep);
    for (let i = 0; i < targetIndex; i++) {
      if (!completed[STEP_IDS[i]]) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("step", STEP_IDS[i]);
        router.replace(`?${params.toString()}`, { scroll: false });
        stepper.navigation.goTo(STEP_IDS[i]);
        return;
      }
    }
    stepper.navigation.goTo(urlStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setStep = (id: StepId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", id);
    router.replace(`?${params.toString()}`, { scroll: false });
    stepper.navigation.goTo(id);
  };

  const goNext = () => {
    const nextIndex = Math.min(currentIndex + 1, STEP_IDS.length - 1);
    setStep(STEP_IDS[nextIndex]);
  };
  const goPrev = () => {
    const prevIndex = Math.max(currentIndex - 1, 0);
    setStep(STEP_IDS[prevIndex]);
  };

  const exitStepper = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("step");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  };

  const canAdvanceFromCurrent = (() => {
    if (currentStepId === "review") return true;
    return completed[currentStepId];
  })();

  const isFirst = currentIndex === 0;
  const isLast = currentStepId === "review";

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
        <StepperNav className="mb-4">
          {stepper.state.all.map((step, index) => {
            const status = getStepStatus(index, currentIndex);
            const priorComplete = STEP_IDS.slice(0, index).every((id) => completed[id]);
            const clickable = index <= currentIndex || priorComplete;
            return (
              <React.Fragment key={step.id}>
                <StepperItem status={status}>
                  <StepperIndicator
                    status={status}
                    step={index + 1}
                    onClick={() => {
                      if (clickable) setStep(STEP_IDS[index]);
                    }}
                    disabled={!clickable}
                  />
                  <StepperTitle status={status} className="hidden sm:block">
                    {step.title}
                  </StepperTitle>
                </StepperItem>
                {index < stepper.state.all.length - 1 && (
                  <StepperSeparator status={status} className="hidden sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </StepperNav>

        {currentStepId === "org-details" && (
          <OrgDetailsStep organization={organization} onOrganizationUpdate={onOrganizationUpdate} />
        )}

        {currentStepId === "legal-name" && (
          <LegalNameStep organization={organization} onOrganizationUpdate={onOrganizationUpdate} />
        )}

        {currentStepId === "fee-disclosure" && (
          <FeeDisclosureStep
            organization={organization}
            plan={plan}
            onOrganizationUpdate={onOrganizationUpdate}
          />
        )}

        {currentStepId === "platform-agreement" && (
          <PlatformAgreementStep
            organization={organization}
            onOrganizationUpdate={onOrganizationUpdate}
          />
        )}

        {currentStepId === "review" && <ReviewStep organization={organization} plan={plan} />}

        <div className="flex items-center justify-between mt-6">
          <Button type="button" variant="outline" onClick={exitStepper} disabled={initiateLoading}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button type="button" variant="outline" onClick={goPrev} disabled={initiateLoading}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}
            {isLast ? (
              <Button
                type="button"
                onClick={() => {
                  void onInitiateAndRedirect();
                }}
                disabled={initiateLoading}
              >
                {initiateLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Begin Verification
                <ExternalLinkIcon className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={!canAdvanceFromCurrent}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Step 1: Organization Details ---

function OrgDetailsStep({
  organization,
  onOrganizationUpdate,
}: {
  organization: OnboardingStepperOrganization;
  onOrganizationUpdate: (org: OnboardingStepperOrganization) => void;
}) {
  const [isEditing, setIsEditing] = useState(!isOrgAddressComplete(organization));

  const address = [
    organization.street,
    organization.city,
    organization.stateProvince,
    organization.postalCode,
    organization.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm your organization details</CardTitle>
        <CardDescription>
          Adyen will use this address and phone number to register your business. All fields are
          required before verification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <OrganizationAddressForm
            organization={organization}
            onSuccess={(updated) => {
              onOrganizationUpdate({ ...organization, ...updated });
              setIsEditing(false);
              toast.success("Organization details saved");
            }}
            onCancel={isOrgAddressComplete(organization) ? () => setIsEditing(false) : undefined}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-4 p-4 border rounded-lg sm:col-span-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPinIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold">Address</h4>
                  {address ? (
                    <p className="text-sm text-muted-foreground">{address}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not provided</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <PhoneIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold">Phone</h4>
                  {organization.phone ? (
                    <p className="text-sm text-muted-foreground">
                      {formatPhoneNumberIntl(organization.phone) || organization.phone}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not provided</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MailIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold">Email</h4>
                  {organization.email ? (
                    <p className="text-sm text-muted-foreground truncate">{organization.email}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not provided</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <PencilIcon className="h-3.5 w-3.5 mr-2" />
                Edit
              </Button>
              {!isOrgAddressComplete(organization) && (
                <Badge variant="destructive">Missing required fields</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Step 2: Legal Name ---

function LegalNameStep({
  organization,
  onOrganizationUpdate,
}: {
  organization: OnboardingStepperOrganization;
  onOrganizationUpdate: (org: OnboardingStepperOrganization) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(organization.name);
  const [saving, setSaving] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const confirmed = !!organization.onboardingLegalNameConfirmedAt;

  const saveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/organization/details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onOrganizationUpdate({ ...organization, name: name.trim() });
      setIsEditing(false);
      toast.success("Legal name saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save legal name");
    } finally {
      setSaving(false);
    }
  };

  const toggleConfirmed = async (checked: boolean) => {
    setProgressSaving(true);
    try {
      const res = await fetch("/api/organization/adyen-onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalNameConfirmed: checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onOrganizationUpdate({
        ...organization,
        onboardingLegalNameConfirmedAt: data.progress.onboardingLegalNameConfirmedAt,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setProgressSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm your legal business name</CardTitle>
        <CardDescription>
          The name below will be submitted to Adyen as your registered legal business name. It must
          match your official business registration exactly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/50 px-4 py-3">
          <p className="text-sm text-muted-foreground">Legal name to be submitted</p>
          {isEditing ? (
            <div className="mt-2 flex items-center gap-2">
              <Label htmlFor="org-legal-name" className="sr-only">
                Legal name
              </Label>
              <Input
                id="org-legal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                className="max-w-md"
              />
              <Button size="sm" onClick={saveName} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName(organization.name);
                  setIsEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between gap-4">
              <p className="font-semibold">{organization.name}</p>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <PencilIcon className="h-3.5 w-3.5 mr-2" />
                Edit
              </Button>
            </div>
          )}
        </div>

        <AcknowledgementCard
          id="legal-name-confirm"
          checked={confirmed}
          disabled={progressSaving || isEditing}
          onCheckedChange={toggleConfirmed}
        >
          I confirm that <span className="font-medium">{organization.name}</span> is our registered
          legal business name.
        </AcknowledgementCard>
      </CardContent>
    </Card>
  );
}

// --- Step 3: Fee Disclosure ---

function FeeDisclosureStep({
  organization,
  plan,
  onOrganizationUpdate,
}: {
  organization: OnboardingStepperOrganization;
  plan: OnboardingStepperPlan;
  onOrganizationUpdate: (org: OnboardingStepperOrganization) => void;
}) {
  const [saving, setSaving] = useState(false);
  const feeAcked = !!organization.onboardingFeeAcknowledgedAt;

  const transactionFeePercent = plan ? `${(Number(plan.transactionFee) * 100).toFixed(2)}%` : "—";
  const perTransactionFlat = plan ? `$${Number(plan.perTransactionFee).toFixed(2)}` : "—";

  const toggleAcknowledged = async (checked: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/organization/adyen-onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeAcknowledged: checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onOrganizationUpdate({
        ...organization,
        onboardingFeeAcknowledgedAt: data.progress.onboardingFeeAcknowledgedAt,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform fee disclosure</CardTitle>
        <CardDescription>
          Review the platform fees that apply to your plan before continuing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Placeholder body copy — to be replaced with product/legal-approved text (USC-206) */}
        <p className="text-sm text-muted-foreground">
          [Fee disclosure copy — pending product/legal review]
        </p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Fee type</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-4 py-3">Transaction fee (% of payout)</td>
                <td className="px-4 py-3 text-right font-mono">{transactionFeePercent}</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Per-transaction flat fee</td>
                <td className="px-4 py-3 text-right font-mono">{perTransactionFlat}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <AcknowledgementCard
          id="fee-acknowledge"
          checked={feeAcked}
          disabled={saving}
          onCheckedChange={toggleAcknowledged}
        >
          I understand that the fees shown above will be deducted from each payout.
        </AcknowledgementCard>
      </CardContent>
    </Card>
  );
}

// --- Step 4: Marketplace Agreement ---

function PlatformAgreementStep({
  organization,
  onOrganizationUpdate,
}: {
  organization: OnboardingStepperOrganization;
  onOrganizationUpdate: (org: OnboardingStepperOrganization) => void;
}) {
  const [saving, setSaving] = useState(false);
  const agreementAccepted = !!organization.onboardingAgreementAcceptedAt;

  const toggleAccepted = async (checked: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/organization/adyen-onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementAccepted: checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onOrganizationUpdate({
        ...organization,
        onboardingAgreementAcceptedAt: data.progress.onboardingAgreementAcceptedAt,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marketplace agreement</CardTitle>
        <CardDescription>
          Review and accept the Uplifter Marketplace Agreement before initiating verification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AcknowledgementCard
          id="platform-agreement"
          checked={agreementAccepted}
          disabled={saving}
          onCheckedChange={toggleAccepted}
        >
          I agree to the{" "}
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
            onClick={(e) => e.stopPropagation()}
          >
            Uplifter Marketplace Agreement
          </a>
          .
        </AcknowledgementCard>
      </CardContent>
    </Card>
  );
}

// --- Step 5: Review ---

function ReviewStep({
  organization,
  plan,
}: {
  organization: OnboardingStepperOrganization;
  plan: OnboardingStepperPlan;
}) {
  const address = [
    organization.street,
    organization.city,
    organization.stateProvince,
    organization.postalCode,
    organization.country,
  ]
    .filter(Boolean)
    .join(", ");

  const transactionFeePercent = plan ? `${(Number(plan.transactionFee) * 100).toFixed(2)}%` : "—";
  const perTransactionFlat = plan ? `$${Number(plan.perTransactionFee).toFixed(2)}` : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review and begin verification</CardTitle>
        <CardDescription>
          Here&apos;s what will be submitted to Adyen. Clicking Begin Verification will open
          Adyen&apos;s secure onboarding page where you&apos;ll upload identity documents and add
          your bank account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border divide-y">
          <ReviewRow label="Legal name" value={organization.name} />
          <ReviewRow label="Registered address" value={address || "—"} />
          <ReviewRow
            label="Phone"
            value={
              organization.phone
                ? formatPhoneNumberIntl(organization.phone) || organization.phone
                : "—"
            }
          />
          <ReviewRow label="Transaction fee" value={transactionFeePercent} />
          <ReviewRow label="Per-transaction flat fee" value={perTransactionFlat} />
        </div>

        <Card className="bg-muted/40 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">What happens next</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• You&apos;ll be redirected to Adyen&apos;s secure onboarding page.</p>
            <p>• Provide business details, identity documents, and bank account information.</p>
            <p>• Return to this dashboard when complete — we&apos;ll track status automatically.</p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

// --- Shared: card-style acknowledgement checkbox ---

function AcknowledgementCard({
  id,
  checked,
  disabled,
  onCheckedChange,
  children,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition-colors select-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        checked ? "border-primary bg-primary/5" : !disabled && "hover:bg-muted/50"
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(val) => onCheckedChange(Boolean(val))}
        className="mt-0.5"
      />
      <span className="text-sm leading-snug">{children}</span>
    </label>
  );
}
