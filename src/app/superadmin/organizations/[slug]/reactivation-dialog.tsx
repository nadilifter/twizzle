"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power } from "lucide-react";
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

interface ReactivationDialogProps {
  organizationId: string;
  organizationName: string;
}

export function ReactivationDialog({ organizationId, organizationName }: ReactivationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/organizations/${organizationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reactivate organization");
      }

      toast.success(`${organizationName} has been reactivated`);
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to reactivate organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="default" size="sm">
          <Power className="mr-2 h-4 w-4" />
          Reactivate Organization
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivate {organizationName}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              This will restore <strong>{organizationName}</strong> to active status. The following
              will be reversed:
            </span>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Subscription billing will resume (if it was paused)</li>
              <li>Admin users will regain dashboard access</li>
              <li>The marketing site will become available again</li>
              <li>Automated notifications will resume</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, Reactivate
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
