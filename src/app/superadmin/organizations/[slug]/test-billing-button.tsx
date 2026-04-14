"use client";

/**
 * Dev-only: Test Billing Run button for the superadmin org detail page.
 *
 * Fast-forwards the org's trial and runs the full billing flow (transition → invoice → payment).
 * Renders nothing in production/staging.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FlaskConical, Loader2 } from "lucide-react";

interface Props {
  orgId: string;
  isDevEnv: boolean;
}

export function TestBillingButton({ orgId, isDevEnv }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    invoice?: { reference?: string; amount?: string; status?: string };
    diagnosis?: string;
  } | null>(null);

  if (!isDevEnv) return null;

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/dev/trigger-trial-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, fastForward: true }),
      });
      const data = await res.json();
      setResult(data);
      if (res.ok && data.success) {
        toast.success(
          `Billing run succeeded — invoice ${data.invoice?.reference ?? ""} paid ($${Number(data.invoice?.amount ?? 0).toFixed(2)})`
        );
      } else {
        toast.error(`Billing run failed: ${data.error ?? data.diagnosis ?? "Unknown error"}`);
      }
    } catch {
      toast.error("Billing run failed — unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="w-fit border-dashed border-amber-400 text-amber-700 hover:bg-amber-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FlaskConical className="h-4 w-4 mr-2" />
        )}
        Test Billing Run
      </Button>
      {result && (
        <p className="text-xs text-muted-foreground">
          {result.success
            ? `✓ Invoice ${result.invoice?.reference} — ${result.invoice?.status}`
            : `✗ ${result.diagnosis ?? "Failed"}`}
        </p>
      )}
    </div>
  );
}
