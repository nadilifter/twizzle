"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AdyenCheckoutComponent } from "@/components/sites/adyen-checkout";

interface Plan {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  transactionFee: number;
  perTransactionFee: number;
  maxAthletes: number | null;
  maxUsers: number | null;
  maxPrograms: number | null;
  maxEvents: number | null;
  smsIncluded: number | null;
  emailIncluded: number | null;
  maxStorageMB: number | null;
  maxMembershipTypes: number | null;
  features: string[];
  isPopular: boolean;
}

interface Props {
  currentPlanId: string | null;
  plans: Plan[];
  currentUsage: {
    athletes: number;
    users: number;
    programs: number;
    events: number;
    storageMB?: number;
    membershipTypes?: number;
  };
  billingCycle: string;
  variant?: "default" | "compact";
  targetPlanId?: string;
  hasPaymentMethod: boolean;
}

export function PlanSelector({
  currentPlanId,
  plans,
  currentUsage,
  billingCycle: initialBillingCycle,
  variant = "default",
  targetPlanId,
  hasPaymentMethod,
}: Props) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedPlanId, setSelectedPlanId] = React.useState(targetPlanId || currentPlanId || "");
  const [billingCycle, setBillingCycle] = React.useState<"MONTHLY" | "YEARLY">(
    initialBillingCycle as "MONTHLY" | "YEARLY"
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [showPaymentForm, setShowPaymentForm] = React.useState(false);
  const [isLoadingSession, setIsLoadingSession] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [sessionData, setSessionData] = React.useState<string | null>(null);
  const [paymentMethodJustAdded, setPaymentMethodJustAdded] = React.useState(false);
  const [cancelStep, setCancelStep] = React.useState<0 | 1 | 2>(0);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // Check if selected plan would exceed limits
  const limitWarnings: string[] = [];
  if (selectedPlan) {
    if (selectedPlan.maxAthletes && currentUsage.athletes > selectedPlan.maxAthletes) {
      limitWarnings.push(
        `This plan allows ${selectedPlan.maxAthletes} athletes, but you have ${currentUsage.athletes}`
      );
    }
    if (selectedPlan.maxUsers && currentUsage.users > selectedPlan.maxUsers) {
      limitWarnings.push(
        `This plan allows ${selectedPlan.maxUsers} users, but you have ${currentUsage.users}`
      );
    }
    if (selectedPlan.maxPrograms && currentUsage.programs > selectedPlan.maxPrograms) {
      limitWarnings.push(
        `This plan allows ${selectedPlan.maxPrograms} programs, but you have ${currentUsage.programs}`
      );
    }
    if (selectedPlan.maxEvents && currentUsage.events > selectedPlan.maxEvents) {
      limitWarnings.push(
        `This plan allows ${selectedPlan.maxEvents} events, but you have ${currentUsage.events}`
      );
    }
    if (
      selectedPlan.maxStorageMB &&
      currentUsage.storageMB &&
      currentUsage.storageMB > selectedPlan.maxStorageMB
    ) {
      const usedGB = (currentUsage.storageMB / 1000).toFixed(1);
      const limitGB = (selectedPlan.maxStorageMB / 1000).toFixed(1);
      limitWarnings.push(`This plan allows ${limitGB} GB storage, but you're using ${usedGB} GB`);
    }
    if (
      selectedPlan.maxMembershipTypes &&
      currentUsage.membershipTypes &&
      currentUsage.membershipTypes > selectedPlan.maxMembershipTypes
    ) {
      limitWarnings.push(
        `This plan allows ${selectedPlan.maxMembershipTypes} membership types, but you have ${currentUsage.membershipTypes}`
      );
    }
  }

  const handleOpenDialog = () => {
    setSelectedPlanId(targetPlanId || currentPlanId || "");
    setIsDialogOpen(true);
  };

  const isPaidPlan = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    return plan ? plan.monthlyPrice > 0 : false;
  };

  const createPaymentSession = async () => {
    setIsLoadingSession(true);
    setShowPaymentForm(true);
    try {
      const response = await fetch("/api/payment-methods/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment session");
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setSessionData(data.sessionData);
    } catch (error) {
      toast.error("Failed to initialize payment form");
      setShowPaymentForm(false);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handlePaymentCompleted = async (result: { resultCode: string }) => {
    if (result.resultCode === "Authorised" || result.resultCode === "Pending") {
      toast.success("Payment method added!");
      setPaymentMethodJustAdded(true);
      setShowPaymentForm(false);
      setSessionId(null);
      setSessionData(null);
      await savePlanChange();
    } else {
      toast.error(`Failed to add payment method: ${result.resultCode}`);
    }
  };

  const handlePaymentError = (error: { message?: string }) => {
    toast.error(error?.message || "Failed to add payment method");
  };

  const resetPaymentForm = () => {
    setShowPaymentForm(false);
    setSessionId(null);
    setSessionData(null);
    setCancelStep(0);
  };

  const handleCancelPlan = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch("/api/organization/subscription/cancel", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel plan");
      }

      toast.success("Your plan has been cancelled.");
      setIsDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel plan");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSave = async () => {
    if (limitWarnings.length > 0) {
      toast.error("Please reduce your usage before switching to this plan");
      return;
    }

    if (isPaidPlan(selectedPlanId) && !hasPaymentMethod && !paymentMethodJustAdded) {
      await createPaymentSession();
      return;
    }

    await savePlanChange();
  };

  const savePlanChange = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/organization/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          billingCycle,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to change plan");
      }

      toast.success("Plan updated successfully!");
      setIsDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change plan");
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatPercent = (amount: number) => {
    return `${(amount * 100).toFixed(1)}%`;
  };

  if (variant === "compact") {
    return (
      <>
        <Button variant="outline" size="sm" onClick={handleOpenDialog}>
          Select
        </Button>
        <PlanDialog />
      </>
    );
  }

  return (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={handleOpenDialog}>
        Change Plan
      </Button>
      <PlanDialog />
    </>
  );

  function PlanDialog() {
    return (
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetPaymentForm();
        }}
      >
        <DialogContent className="max-w-lg">
          {cancelStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Cancel Plan
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to cancel your plan? This will immediately:
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>Deactivate your organization</li>
                  <li>Stop all recurring billing</li>
                  <li>Block admin users from accessing the dashboard</li>
                  <li>Take down your marketing site</li>
                  <li>Halt all automated notifications and campaigns</li>
                </ul>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCancelStep(0)}>
                  Back
                </Button>
                <Button variant="destructive" onClick={() => setCancelStep(2)}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : cancelStep === 2 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Confirm Cancellation
                </DialogTitle>
                <DialogDescription>
                  This action takes effect immediately. You can reactivate your organization later
                  from the deactivation page.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  Your organization will be deactivated and your subscription will be cancelled. Any
                  pending invoices will be voided.
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCancelStep(1)} disabled={isCancelling}>
                  Back
                </Button>
                <Button variant="destructive" onClick={handleCancelPlan} disabled={isCancelling}>
                  {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Yes, Cancel My Plan
                </Button>
              </DialogFooter>
            </>
          ) : showPaymentForm ? (
            <>
              <DialogHeader>
                <DialogTitle>Payment Method Required</DialogTitle>
                <DialogDescription>
                  A payment method is required to subscribe to the {selectedPlan?.name} plan. Add
                  one below to continue.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                {isLoadingSession ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : sessionId && sessionData ? (
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetPaymentForm}>
                  Back
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Change Subscription Plan</DialogTitle>
                <DialogDescription>Select a new plan for your organization</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="flex items-center gap-2">
                            {plan.name} - {formatCurrency(plan.monthlyPrice)}/mo
                            {plan.isPopular && (
                              <Badge variant="secondary" className="ml-2">
                                Popular
                              </Badge>
                            )}
                            {plan.id === currentPlanId && (
                              <Badge variant="outline" className="ml-2">
                                Current
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select
                    value={billingCycle}
                    onValueChange={(v) => setBillingCycle(v as "MONTHLY" | "YEARLY")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">
                        Yearly{" "}
                        {selectedPlan?.yearlyPrice
                          ? `(${formatCurrency(selectedPlan.yearlyPrice)})`
                          : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedPlan && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium">Plan Details</h4>
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price</span>
                          <span className="font-medium">
                            {formatCurrency(
                              billingCycle === "YEARLY" && selectedPlan.yearlyPrice
                                ? selectedPlan.yearlyPrice
                                : selectedPlan.monthlyPrice * (billingCycle === "YEARLY" ? 12 : 1)
                            )}
                            /{billingCycle.toLowerCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Transaction Fee</span>
                          <span className="font-medium">
                            {formatPercent(selectedPlan.transactionFee)} +{" "}
                            {formatCurrency(selectedPlan.perTransactionFee)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Athletes</span>
                          <span className="font-medium">
                            {selectedPlan.maxAthletes || "Unlimited"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Users</span>
                          <span className="font-medium">
                            {selectedPlan.maxUsers || "Unlimited"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Programs</span>
                          <span className="font-medium">
                            {selectedPlan.maxPrograms || "Unlimited"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SMS/month</span>
                          <span className="font-medium">{selectedPlan.smsIncluded || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Emails/month</span>
                          <span className="font-medium">{selectedPlan.emailIncluded || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Storage</span>
                          <span className="font-medium">
                            {selectedPlan.maxStorageMB
                              ? selectedPlan.maxStorageMB >= 1000
                                ? `${selectedPlan.maxStorageMB / 1000} GB`
                                : `${selectedPlan.maxStorageMB} MB`
                              : "Unlimited"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Membership Types</span>
                          <span className="font-medium">
                            {selectedPlan.maxMembershipTypes || "Unlimited"}
                          </span>
                        </div>
                      </div>

                      {selectedPlan.features.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <h5 className="text-sm font-medium text-muted-foreground">Features</h5>
                          {selectedPlan.features.slice(0, 5).map((feature, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-500" />
                              <span>{feature}</span>
                            </div>
                          ))}
                          {selectedPlan.features.length > 5 && (
                            <p className="text-sm text-muted-foreground">
                              +{selectedPlan.features.length - 5} more features
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {limitWarnings.length > 0 && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Cannot switch to this plan</span>
                    </div>
                    <ul className="text-sm text-destructive/90 list-disc list-inside">
                      {limitWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {currentPlanId && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto"
                    onClick={() => setCancelStep(1)}
                  >
                    Cancel Plan
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Close
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    isSaving ||
                    !selectedPlanId ||
                    selectedPlanId === currentPlanId ||
                    limitWarnings.length > 0
                  }
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Change
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }
}
