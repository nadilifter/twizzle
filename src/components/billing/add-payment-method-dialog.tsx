"use client";

import { type ReactNode, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdyenCheckoutComponent } from "@/components/sites/adyen-checkout";

interface AddPaymentMethodDialogProps {
  sessionEndpoint: string;
  onPaymentMethodAdded: () => void | Promise<void>;
  trigger?: ReactNode;
  description?: string;
  componentType?: string;
}

export function AddPaymentMethodDialog({
  sessionEndpoint,
  onPaymentMethodAdded,
  trigger,
  description = "Add a card, digital wallet, or bank account to your account.",
  componentType,
}: AddPaymentMethodDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<{
    sessionId: string;
    sessionData: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) {
      abortRef.current?.abort();
      abortRef.current = null;
      setSession(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const res = await fetch(sessionEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.href }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to create payment session");
      const data = await res.json();
      setSession({ sessionId: data.sessionId, sessionData: data.sessionData });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("Failed to initialize payment form");
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentCompleted = async (result: { resultCode: string }) => {
    if (result.resultCode === "Authorised" || result.resultCode === "Pending") {
      toast.success("Payment method added successfully!");
      setOpen(false);
      setSession(null);
      await onPaymentMethodAdded();
    } else {
      toast.error(`Failed to add payment method: ${result.resultCode}`);
    }
  };

  const handleError = (error: { message?: string }) => {
    toast.error(error?.message || "Failed to add payment method");
  };

  const resolvedTrigger = trigger ?? (
    <Button size="sm">
      <Plus className="h-4 w-4 mr-1" />
      Add Payment Method
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{resolvedTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading || !session ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AdyenCheckoutComponent
              sessionId={session.sessionId}
              sessionData={session.sessionData}
              componentType={componentType}
              onPaymentCompleted={handlePaymentCompleted}
              onError={handleError}
              showStoredPaymentMethods={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
