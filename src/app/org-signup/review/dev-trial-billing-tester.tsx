"use client";

/**
 * Dev-only: Trial Billing Tester
 *
 * Renders a checkbox on the org signup review page (local/dev only, paid plans only) that,
 * when checked, triggers the subscription billing flow automatically after org creation.
 *
 * After the org is created, waits 10 seconds then calls /api/dev/trigger-trial-billing,
 * which replicates the monthly billing cron scoped to the new org. The org is created with
 * trialEndsAt set to yesterday so the billing guard lets it through immediately.
 *
 * Will go through payment process for the org's invoice, then toasts the result (success or failure) then redirects to the success page.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  runCronAfterCreation: boolean;
  onToggle: (value: boolean) => void;
  pendingCron: { orgId: string; successUrl: string } | null;
}

export function DevTrialBillingTester({ runCronAfterCreation, onToggle, pendingCron }: Props) {
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!pendingCron || firedRef.current) return;
    firedRef.current = true;
    toast.info("Billing cron job will run in 10 seconds...");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/dev/trigger-trial-billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: pendingCron.orgId }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          toast.success("Billing cron job ran successfully");
        } else {
          toast.error(`Billing cron job failed: ${data.error ?? "Unknown error"}`);
        }
      } catch {
        toast.error("Billing cron job failed to run");
      }
      router.push(pendingCron.successUrl);
    }, 10000);
    return () => clearTimeout(timer);
  }, [pendingCron, router]);

  if (pendingCron) return null;

  return (
    <div className="flex items-center gap-2 mb-3">
      <input
        id="runCronAfterCreation"
        type="checkbox"
        checked={runCronAfterCreation}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4"
      />
      <label htmlFor="runCronAfterCreation" className="text-xs text-muted-foreground">
        Run billing cron after org creation (dev only)
      </label>
    </div>
  );
}
