"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const DEACTIVATION_REASONS = [
  "Non-payment",
  "Requested by customer",
  "Policy violation",
  "Inactivity",
  "Other",
] as const;

interface DeactivationDialogProps {
  organizationId: string;
  organizationName: string;
}

export function DeactivationDialog({ organizationId, organizationName }: DeactivationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const resetState = () => {
    setStep(1);
    setReason("");
    setNotes("");
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetState();
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/organizations/${organizationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deactivate",
          reason,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to deactivate organization");
      }

      toast.success(`${organizationName} has been deactivated`);
      setOpen(false);
      resetState();
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to deactivate organization");
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Deactivate Organization
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === 1 && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {organizationName}</AlertDialogTitle>
              <AlertDialogDescription>
                Select a reason for deactivating this organization. You can also add optional notes
                for internal records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger id="reason">
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEACTIVATION_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional context..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={() => setStep(2)} disabled={!reason}>
                Continue
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Deactivation
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  You are about to deactivate <strong>{organizationName}</strong>. This will:
                </span>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Pause all recurring billing</li>
                  <li>Block admin users from accessing the dashboard</li>
                  <li>Take down the organization&apos;s marketing site</li>
                  <li>Halt all automated notifications</li>
                </ul>
                <span className="block font-medium">Reason: {reason}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
                Back
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Deactivate
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
