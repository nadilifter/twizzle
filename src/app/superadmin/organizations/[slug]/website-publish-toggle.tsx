"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, Globe, GlobeLock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WebsitePublishToggleProps {
  organizationId: string;
  organizationName: string;
  isPublished: boolean;
  adyenVerified: boolean;
}

export function WebsitePublishToggle({
  organizationId,
  organizationName,
  isPublished,
  adyenVerified,
}: WebsitePublishToggleProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleToggle = () => {
    if (!isPublished && !adyenVerified) {
      setShowWarning(true);
      return;
    }
    performToggle();
  };

  const performToggle = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/organizations/${organizationId}/website`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !isPublished }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update site status");
      }

      toast.success(
        isPublished
          ? `${organizationName} site unpublished`
          : `${organizationName} site is now live`
      );
      setShowWarning(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to update site status");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge variant={isPublished ? "default" : "secondary"}>
          {isPublished ? (
            <>
              <Globe className="mr-1 h-3 w-3" />
              Published
            </>
          ) : (
            <>
              <GlobeLock className="mr-1 h-3 w-3" />
              Unpublished
            </>
          )}
        </Badge>
        <Button variant="outline" size="sm" onClick={handleToggle} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPublished ? "Unpublish Site" : "Publish Site"}
        </Button>
      </div>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Payment Processing Not Set Up
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                <strong>{organizationName}</strong> has not completed payment processing setup.
                Publishing their site means visitors may attempt to register but won&apos;t be able
                to pay.
              </span>
              <span className="block">Are you sure you want to publish this site?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button onClick={performToggle} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Publish Anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
