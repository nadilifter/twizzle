// Persistent banner shown to athletes with a WAITLIST_PAYMENT_PENDING enrollment and an active
// deadline. Lets them add a new payment method and immediately retry the charge via the retry
// endpoint. Renders nothing while loading or when no pending charge exists.

"use client";

import { useState, useEffect } from "react";
import { Loader2, CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { AddPaymentMethodDialog } from "@/components/billing/add-payment-method-dialog";

interface PendingCharge {
  id: string;
  waitlistPaymentDeadline: string;
  program: {
    name: string;
    basePrice: number | null;
    perSessionPrice: number | null;
    pricingModel: string;
  };
}

type BannerState = "idle" | "processing" | "success" | "error";

export function WaitlistPaymentBanner() {
  const [enrollment, setEnrollment] = useState<PendingCharge | null | undefined>(undefined);
  const [showDialog, setShowDialog] = useState(false);
  const [bannerState, setBannerState] = useState<BannerState>("idle");
  const [chargeError, setChargeError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/user/waitlist-pending-charge", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setEnrollment(data.enrollment ?? null))
      .catch((err) => {
        if (err.name !== "AbortError") setEnrollment(null);
      });
    return () => controller.abort();
  }, []);

  const handlePaymentMethodAdded = async () => {
    setShowDialog(false);
    setBannerState("processing");
    setChargeError(null);
    try {
      // The payment method is persisted via Adyen webhook which is async — poll until it
      // lands, but bail immediately on a real charge failure.
      let lastError = "Payment failed. Please try a different card.";
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
        const res = await fetch("/api/user/waitlist-pending-charge/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId: enrollment?.id }),
        });
        const data = await res.json();
        if (data.success) {
          setBannerState("success");
          return;
        }
        if (data.error === "No payment method found") continue;
        lastError = data.error ?? lastError;
        break;
      }
      setChargeError(lastError);
      setBannerState("error");
    } catch {
      setChargeError("Something went wrong. Please try again.");
      setBannerState("error");
    }
  };

  if (enrollment === undefined || enrollment === null) return null;

  const amount =
    enrollment.program.pricingModel === "PER_SESSION"
      ? enrollment.program.perSessionPrice
      : enrollment.program.basePrice;

  const deadline = new Date(enrollment.waitlistPaymentDeadline);
  const formattedDeadline = format(deadline, "MMM d 'at' h:mm a");
  const formattedAmount = amount
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
    : null;

  return (
    <>
      <div
        className={`sticky top-0 z-50 w-full px-4 py-2.5 ${bannerState === "success" ? "bg-green-500 text-green-950" : "bg-amber-500 text-amber-950"}`}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto gap-4">
          {bannerState === "success" ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>
                  Payment successful! You&apos;re enrolled in{" "}
                  <strong>{enrollment.program.name}</strong>. Refresh the page to see your updated
                  registration.
                </span>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-green-950 text-green-50 hover:bg-green-900 h-7 px-3 text-xs"
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
            </>
          ) : bannerState === "processing" ? (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span>
                Securing your spot in <strong>{enrollment.program.name}</strong>…
              </span>
            </div>
          ) : bannerState === "error" ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{chargeError}</span>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-amber-950 text-amber-50 hover:bg-amber-900 h-7 px-3 text-xs"
                onClick={() => {
                  setBannerState("idle");
                  setShowDialog(true);
                }}
              >
                Try Again
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 shrink-0" />
                <span>
                  A spot opened up in <strong>{enrollment.program.name}</strong>! Your payment
                  failed. Add a payment method to secure your spot — you have until{" "}
                  <strong>{formattedDeadline}</strong>.
                </span>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-amber-950 text-amber-50 hover:bg-amber-900 h-7 px-3 text-xs"
                onClick={() => setShowDialog(true)}
              >
                Add Payment Method
              </Button>
            </>
          )}
        </div>
      </div>

      {bannerState !== "success" && (
        <AddPaymentMethodDialog
          sessionEndpoint="/api/user/payment-methods/session"
          description={
            formattedAmount
              ? `Adding this card will immediately charge you ${formattedAmount} for ${enrollment.program.name}.`
              : `Adding this card will secure your spot in ${enrollment.program.name}.`
          }
          open={showDialog}
          onOpenChange={setShowDialog}
          onPaymentMethodAdded={handlePaymentMethodAdded}
        />
      )}
    </>
  );
}
