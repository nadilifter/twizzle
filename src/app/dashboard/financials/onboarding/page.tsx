"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  Building2Icon,
  UniversityIcon,
  UserIcon,
  Loader2,
  ExternalLinkIcon,
  RefreshCwIcon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";
import {
  firstIncompleteStep,
  OnboardingStepper,
  type OnboardingStepperOrganization,
  type OnboardingStepperPlan,
} from "./onboarding-stepper";

type OnboardingAccount = {
  onboardingStatus: string;
  verificationStatus: string | null;
  capabilities: Record<string, any> | null;
  capabilityProblems: { capability: string; code: string; message: string }[];
  hasStore: boolean;
  hasSweep: boolean;
  payoutSchedule: string | null;
  legalEntityId: string | null;
  accountHolderId: string | null;
  balanceAccountId: string | null;
  verifiedAt: string | null;
  transferInstrumentId?: string | null;
};

type OrganizationDetails = OnboardingStepperOrganization & {
  taxRate: string | number | null;
  taxEnabled: boolean;
};

type PlanDetails = NonNullable<OnboardingStepperPlan>;
const NON_TERMINAL_STATUSES = ["PENDING_HOSTED", "IN_PROGRESS", "IN_REVIEW", "AWAITING_DATA"];

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const [account, setAccount] = useState<OnboardingAccount | null>(null);
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/organization/adyen-onboarding");
      const data = await res.json();
      if (res.ok) {
        setAccount(data.account);
        setOrganization(data.organization);
        setPlan(data.plan);
        setLastUpdated(new Date());
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to load onboarding status");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchStatus();
  }, []);

  // Background polling for non-terminal statuses
  const accountStatus = account?.onboardingStatus;
  useEffect(() => {
    if (!accountStatus || !NON_TERMINAL_STATUSES.includes(accountStatus)) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchStatus();
    }, 120000); // poll every 2 minutes

    return () => clearInterval(interval);
  }, [accountStatus]);

  // Keep "X seconds ago" counter in sync; stop when status is terminal
  useEffect(() => {
    if (!lastUpdated || !accountStatus || !NON_TERMINAL_STATUSES.includes(accountStatus)) {
      setSecondsAgo(null);
      return;
    }
    const update = () => setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated, accountStatus]);

  const handleInitiateAndRedirect = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const initRes = await fetch("/api/organization/adyen-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalNameConfirmed: true,
          platformAgreementAccepted: true,
          platformFeeAcknowledged: true,
        }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) {
        setError(initData.error || "Failed to initiate onboarding");
        setActionLoading(false);
        return;
      }

      const linkRes = await fetch("/api/organization/adyen-onboarding/link", {
        method: "POST",
      });
      const linkData = await linkRes.json();
      if (linkRes.ok && linkData.url) {
        window.location.href = linkData.url;
        return;
      }

      setError(linkData.error || "Failed to generate onboarding link");
      await fetchStatus();
      setActionLoading(false);
    } catch {
      setError("Failed to begin verification");
      setActionLoading(false);
    }
  };

  const handleGetLink = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organization/adyen-onboarding/link", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to generate onboarding link");
        setActionLoading(false);
      }
    } catch {
      setError("Failed to generate onboarding link");
      setActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organization/adyen-onboarding/finalize", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        await fetchStatus();
      } else {
        setError(data.error || "Failed to finalize setup");
      }
    } catch {
      setError("Failed to finalize setup");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchStatus();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Account Onboarding</h1>
          <p className="text-muted-foreground">
            Verify your business details to start processing payments.
          </p>
        </div>
        {account && (
          <div className="flex items-center gap-3">
            {lastUpdated && secondsAgo !== null && (
              <span className="text-xs text-muted-foreground">
                Updated{" "}
                {secondsAgo === 0
                  ? "just now"
                  : secondsAgo < 60
                    ? `${secondsAgo}s ago`
                    : `${Math.floor(secondsAgo / 60)}m ${secondsAgo % 60}s ago`}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!account && organization && !stepParam && (
        <OnboardingLandingCTA
          organization={organization}
          onStart={(targetStep) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("step", targetStep);
            router.replace(`?${params.toString()}`, { scroll: false });
          }}
        />
      )}
      {!account && organization && stepParam && (
        <OnboardingStepper
          organization={organization}
          plan={plan}
          onOrganizationUpdate={(org) =>
            setOrganization((prev) => ({ ...(prev as OrganizationDetails), ...org }))
          }
          onInitiateAndRedirect={handleInitiateAndRedirect}
          initiateLoading={actionLoading}
        />
      )}
      {account?.onboardingStatus === "PENDING_HOSTED" && (
        <PendingHostedState account={account} onGetLink={handleGetLink} loading={actionLoading} />
      )}
      {(account?.onboardingStatus === "IN_PROGRESS" ||
        account?.onboardingStatus === "IN_REVIEW" ||
        account?.onboardingStatus === "AWAITING_DATA") &&
        (account.verifiedAt ? (
          <RegressedState account={account} onGetLink={handleGetLink} loading={actionLoading} />
        ) : (
          <InProgressState
            account={account}
            onGetLink={handleGetLink}
            onRefresh={handleRefresh}
            loading={actionLoading}
          />
        ))}
      {account?.onboardingStatus === "VERIFIED" && (
        <VerifiedState
          account={account}
          onFinalize={handleFinalize}
          onGetLink={handleGetLink}
          loading={actionLoading}
        />
      )}
      {account?.onboardingStatus === "REJECTED" && (
        <RejectedState account={account} onGetLink={handleGetLink} loading={actionLoading} />
      )}
    </div>
  );
}

function OnboardingLandingCTA({
  organization,
  onStart,
}: {
  organization: OrganizationDetails;
  onStart: (targetStep: string) => void;
}) {
  const hasProgress =
    !!organization.onboardingLegalNameConfirmedAt ||
    !!organization.onboardingFeeAcknowledgedAt ||
    !!organization.onboardingAgreementAcceptedAt;
  // On a fresh start, always land on step 1 so the user explicitly reviews org details.
  // Only use resume logic when they've already begun checking off later gates.
  const targetStep = hasProgress ? firstIncompleteStep(organization) : "org-details";
  const ctaLabel = hasProgress ? "Continue Onboarding" : "Begin Onboarding";

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Get Started with Payment Processing</CardTitle>
        <CardDescription>
          To accept payments and receive payouts, you need to verify your business details with our
          payment provider, Adyen. We&apos;ll walk you through it in five quick steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {[
            {
              step: 1,
              title: "Confirm organization details",
              desc: "Check your address and phone number.",
            },
            {
              step: 2,
              title: "Confirm legal name",
              desc: "Make sure your legal business name is correct.",
            },
            {
              step: 3,
              title: "Platform fees",
              desc: "Review the fees deducted from each payout.",
            },
            {
              step: 4,
              title: "Terms of Service",
              desc: "Accept the Uplifter Terms of Service.",
            },
            {
              step: 5,
              title: "Review & begin",
              desc: "Review and get redirected to Adyen to finish verification.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-primary">
                {step}
              </div>
              <div>
                <h4 className="font-semibold">{title}</h4>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => onStart(targetStep)}>
          {ctaLabel}
          <ExternalLinkIcon className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function PendingHostedState({
  account,
  onGetLink,
  loading,
}: {
  account: OnboardingAccount;
  onGetLink: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Verification</CardTitle>
        <CardDescription>
          Your account structure has been created. Complete the verification process with Adyen to
          start accepting payments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ClockIcon className="h-4 w-4" />
          <AlertTitle>Verification Pending</AlertTitle>
          <AlertDescription>
            Click the button below to continue to Adyen&apos;s secure verification page where
            you&apos;ll provide business details, identity documents, and bank account information.
          </AlertDescription>
        </Alert>
        <StatusRows account={account} />
      </CardContent>
      <CardFooter>
        <Button onClick={() => onGetLink()} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Continue to Adyen
          <ExternalLinkIcon className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function InProgressState({
  account,
  onGetLink,
  onRefresh,
  loading,
}: {
  account: OnboardingAccount;
  onGetLink: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Verification In Progress</CardTitle>
              <CardDescription>
                {account.verificationStatus || "Your verification is being processed."}
              </CardDescription>
            </div>
            <StatusBadge status={account.onboardingStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CapabilitiesDisplay capabilities={account.capabilities} />
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Check Status
          </Button>
          <Button variant="outline" onClick={() => onGetLink()} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Return to Adyen
            <ExternalLinkIcon className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>

      <HelpCard />
    </div>
  );
}

function RegressedState({
  account,
  onGetLink,
  loading,
}: {
  account: OnboardingAccount;
  onGetLink: () => void;
  loading: boolean;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Verification Requires Attention</CardTitle>
              <CardDescription>
                Your account was previously verified but now requires re-verification.
              </CardDescription>
            </div>
            <StatusBadge status={account.onboardingStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertCircleIcon className="h-4 w-4 text-amber-600" />
            <AlertTitle>Payouts Paused</AlertTitle>
            <AlertDescription>
              Your account verification requires attention. Payouts have been paused until your
              account is re-verified. This may be due to an expired document, a removed bank
              account, or a periodic review initiated by our payment provider.
            </AlertDescription>
          </Alert>
          <CapabilitiesDisplay capabilities={account.capabilities} />
        </CardContent>
        <CardFooter>
          <Button onClick={onGetLink} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Re-enter Setup
            <ExternalLinkIcon className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>

      <HelpCard />
    </div>
  );
}

function VerifiedState({
  account,
  onFinalize,
  onGetLink,
  loading,
}: {
  account: OnboardingAccount;
  onFinalize: () => void;
  onGetLink: () => void;
  loading: boolean;
}) {
  const needsFinalize = !account.hasStore;
  const missingBankAccount = account.hasStore && !account.hasSweep;

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Verification Status</CardTitle>
          <CardDescription>
            Your account capabilities based on provided information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {missingBankAccount ? (
            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
              <AlertCircleIcon className="h-4 w-4 text-amber-600" />
              <AlertTitle>Bank Account Required</AlertTitle>
              <AlertDescription>
                Your identity has been verified, but we couldn&apos;t find a linked bank account.
                Please re-enter setup to add your bank account before payouts can be processed.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <CheckCircle2Icon className="h-4 w-4 text-green-600" />
              <AlertTitle>
                {needsFinalize ? "Verification Complete" : "Ready to Process"}
              </AlertTitle>
              <AlertDescription>
                {needsFinalize
                  ? "Your account is verified. Finalize setup to start accepting payments."
                  : "Your account is fully set up. You can now accept payments and receive payouts."}
              </AlertDescription>
            </Alert>
          )}
          <StatusRows account={account} verified />
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
          <div className="text-sm text-muted-foreground">
            Account Holder:{" "}
            <span className="font-mono text-foreground">{account.accountHolderId}</span>
          </div>
          <div className="flex gap-3">
            {needsFinalize && (
              <Button onClick={onFinalize} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Finalize Setup
              </Button>
            )}
            {missingBankAccount && (
              <>
                <Button variant="outline" onClick={onGetLink} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Bank Account
                  <ExternalLinkIcon className="h-4 w-4 ml-2" />
                </Button>
                <Button onClick={onFinalize} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Complete Payout Setup
                </Button>
              </>
            )}
            {!needsFinalize && !missingBankAccount && (
              <Button variant="outline" size="sm" onClick={onFinalize} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Re-run Setup
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {account.balanceAccountId && (
            <div>
              <span className="text-muted-foreground">Balance Account</span>
              <p className="font-mono">{account.balanceAccountId}</p>
            </div>
          )}
          {account.hasStore && (
            <div>
              <span className="text-muted-foreground">Store</span>
              <p className="font-mono text-green-600">Configured</p>
            </div>
          )}
          {account.hasSweep ? (
            <div>
              <span className="text-muted-foreground">Payouts</span>
              <p className="font-mono text-green-600 capitalize">
                {account.payoutSchedule ?? "daily"} sweep active
              </p>
            </div>
          ) : account.hasStore ? (
            <div>
              <span className="text-muted-foreground">Payouts</span>
              <p className="font-mono text-amber-600">Bank account required</p>
            </div>
          ) : null}
          {account.transferInstrumentId && (
            <div>
              <span className="text-muted-foreground">Linked Bank Account</span>
              <p className="font-mono">{account.transferInstrumentId}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RejectedState({
  account,
  onGetLink,
  loading,
}: {
  account: OnboardingAccount;
  onGetLink: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification Issues</CardTitle>
        <CardDescription>
          There are issues that need your attention before verification can proceed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <XCircleIcon className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            {account.verificationStatus ||
              "There are issues with your verification. Please review and update your details."}
          </AlertDescription>
        </Alert>
        <CapabilitiesDisplay capabilities={account.capabilities} />
      </CardContent>
      <CardFooter>
        <Button onClick={() => onGetLink()} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Update Details on Adyen
          <ExternalLinkIcon className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// --- Shared components ---

function StatusRows({
  account,
  verified = false,
}: {
  account: OnboardingAccount;
  verified?: boolean;
}) {
  const bankAccountMissing = verified && account.hasStore && !account.hasSweep;

  const rows = [
    {
      icon: Building2Icon,
      title: "Legal Entity",
      desc: "Business details and address",
      done: !!account.legalEntityId,
      warning: false,
    },
    {
      icon: UserIcon,
      title: "Identity Verification",
      desc: "Ultimate Beneficial Owners (UBOs)",
      done: verified,
      warning: false,
    },
    {
      icon: UniversityIcon,
      title: "Bank Account",
      desc: "Payout destination details",
      done: verified && account.hasSweep,
      warning: bankAccountMissing,
    },
  ];

  return (
    <div className="grid gap-4">
      {rows.map(({ icon: Icon, title, desc, done, warning }) => (
        <div key={title} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">{title}</h4>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </div>
          {done ? (
            <CheckCircle2Icon className="h-5 w-5 text-green-600" />
          ) : warning ? (
            <AlertCircleIcon className="h-5 w-5 text-amber-500" />
          ) : (
            <ClockIcon className="h-5 w-5 text-amber-500" />
          )}
        </div>
      ))}
    </div>
  );
}

function CapabilitiesDisplay({ capabilities }: { capabilities: Record<string, any> | null }) {
  if (!capabilities || Object.keys(capabilities).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Capability information will appear here once verification begins.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {Object.entries(capabilities).map(([name, cap]) => {
        const invalid = cap.verificationStatus === "invalid";
        const allowed = cap.allowed === true && !invalid;
        const pending = cap.verificationStatus === "pending";
        const problems: any[] = cap.problems ?? [];
        const errors = problems.flatMap((p: any) => p.verificationErrors ?? []);

        return (
          <div key={name} className="rounded-md border text-sm">
            <div className="flex items-center justify-between py-2 px-3">
              <span className="capitalize">{name.replace(/([A-Z])/g, " $1").trim()}</span>
              {allowed ? (
                <Badge variant="default" className="bg-green-600">
                  Allowed
                </Badge>
              ) : invalid ? (
                <Badge variant="destructive">Action needed</Badge>
              ) : pending ? (
                <Badge variant="secondary">Pending</Badge>
              ) : (
                <Badge variant="destructive">Action needed</Badge>
              )}
            </div>
            {invalid && errors.length > 0 && (
              <ul className="px-3 pb-2 space-y-1">
                {errors.map((e: any, i: number) => (
                  <li key={i} className="text-xs text-destructive flex items-start gap-1">
                    <AlertCircleIcon className="h-3 w-3 mt-0.5 shrink-0" />
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
    IN_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-800" },
    AWAITING_DATA: { label: "Action Needed", className: "bg-orange-100 text-orange-800" },
  };
  const v = variants[status] || { label: status, className: "" };
  return <Badge className={v.className}>{v.label}</Badge>;
}

function HelpCard() {
  return (
    <Card className="bg-muted/50">
      <CardHeader>
        <CardTitle>Need Help?</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          Verification typically takes 1-2 business days. Status updates arrive automatically. If
          you need assistance, contact our support team.
        </p>
        <Button variant="link" className="px-0 mt-2">
          Contact Support &rarr;
        </Button>
      </CardContent>
    </Card>
  );
}
