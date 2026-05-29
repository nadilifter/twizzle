"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Clock, CalendarPlus, XCircle } from "lucide-react";

interface GracePeriodManagerProps {
  organizationId: string;
  orgName: string;
  scheduledDeactivationDate: string;
}

export function GracePeriodManager({
  organizationId,
  orgName,
  scheduledDeactivationDate,
}: GracePeriodManagerProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"extend" | "clear" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [days, setDays] = useState("14");
  const [reason, setReason] = useState("");

  const deactivationDate = new Date(scheduledDeactivationDate);
  const daysRemaining = Math.ceil(
    (deactivationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const resetForm = () => {
    setDays("14");
    setReason("");
    setDialog(null);
  };

  const handleAction = async (action: "extend" | "clear") => {
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = { action, reason };
      if (action === "extend") {
        body.days = parseInt(days, 10);
      }

      const res = await fetch(`/api/superadmin/organizations/${organizationId}/grace-period`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message);
        resetForm();
        router.refresh();
      } else {
        toast.error(data.error || "Action failed.");
      }
    } catch {
      toast.error("An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
        <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-amber-700">Billing grace period active</p>
          <p className="text-sm text-muted-foreground">
            All payment methods failed. This organization will be deactivated in{" "}
            <strong>{Math.max(daysRemaining, 0)} days</strong> (
            {deactivationDate.toLocaleDateString()}) unless a valid payment is received.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setDialog("extend")}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Extend Grace Period
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setDialog("clear")}
            >
              <XCircle className="h-3.5 w-3.5" />
              Clear Grace Period
            </Button>
          </div>
        </div>
      </div>

      {/* Extend Dialog */}
      <Dialog open={dialog === "extend"} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Grace Period</DialogTitle>
            <DialogDescription>
              Add additional days to the grace period for{" "}
              <span className="font-medium">{orgName}</span>. Current deactivation date:{" "}
              {deactivationDate.toLocaleDateString()}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="extend-days">Days to add</Label>
              <Input
                id="extend-days"
                type="number"
                min="1"
                max="365"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="extend-reason">Reason</Label>
              <Textarea
                id="extend-reason"
                placeholder="e.g. Customer requested more time, waiting for wire transfer..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() => handleAction("extend")}
              disabled={isSubmitting || !reason.trim() || !days || parseInt(days) < 1}
            >
              {isSubmitting ? "Extending..." : `Extend by ${days} day(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Dialog */}
      <Dialog open={dialog === "clear"} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Grace Period</DialogTitle>
            <DialogDescription>
              Remove the deactivation threat for <span className="font-medium">{orgName}</span> and
              restore the subscription to active. The customer will not be charged — this is a
              goodwill action.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clear-reason">Reason</Label>
              <Textarea
                id="clear-reason"
                placeholder="e.g. Billing error on our side, customer escalation resolved..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => handleAction("clear")} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting ? "Clearing..." : "Clear Grace Period"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
