"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface BillingGracePeriodBannerProps {
  scheduledDeactivationDate: Date | null;
}

export function BillingGracePeriodBanner({
  scheduledDeactivationDate,
}: BillingGracePeriodBannerProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<{ success: boolean; message: string } | null>(
    null
  );

  if (!scheduledDeactivationDate) return null;

  const deactivationDate = new Date(scheduledDeactivationDate);
  const daysRemaining = Math.max(
    0,
    Math.ceil((deactivationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryResult(null);
    try {
      const response = await fetch("/api/payment-methods/retry-billing", { method: "POST" });
      const data = await response.json();
      setRetryResult({ success: data.success, message: data.message });
      if (data.success) {
        setTimeout(() => router.refresh(), 1500);
      }
    } catch {
      setRetryResult({ success: false, message: "An error occurred. Please try again." });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="border-b border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
      <div className="flex items-start gap-3 max-w-screen-xl mx-auto">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            Payment required &mdash; {daysRemaining} {daysRemaining === 1 ? "day" : "days"}{" "}
            remaining
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
            We were unable to process your subscription payment. Please update your payment method
            to avoid service interruption. Your site will be deactivated on{" "}
            {deactivationDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            .
          </p>
          {retryResult && (
            <p
              className={`text-sm mt-1 font-medium ${retryResult.success ? "text-green-700" : "text-red-700"}`}
            >
              {retryResult.message}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500 text-amber-700 hover:bg-amber-100"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? "Retrying..." : "Retry Payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
