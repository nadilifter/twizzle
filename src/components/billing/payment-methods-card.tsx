"use client";

import * as React from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Loader2,
  Wallet,
  Landmark,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AdyenCheckoutComponent } from "@/components/sites/adyen-checkout";
import { getMethodLabel } from "@/lib/payment-utils";

interface PaymentMethod {
  id: string;
  storedPaymentMethodId: string;
  type: string;
  brand: string | null;
  lastFour: string;
  expiryMonth: string | null;
  expiryYear: string | null;
  holderName: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface PaymentMethodsCardProps {
  paymentMethods: PaymentMethod[];
  organizationId: string;
  hasSubscription: boolean;
}

export function PaymentMethodsCard({
  paymentMethods: initialPaymentMethods,
  organizationId,
  hasSubscription,
}: PaymentMethodsCardProps) {
  const [paymentMethods, setPaymentMethods] = React.useState(initialPaymentMethods);
  React.useEffect(() => {
    setPaymentMethods(initialPaymentMethods);
  }, [initialPaymentMethods]);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [sessionData, setSessionData] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = React.useState<string | null>(null);

  const handleAddPaymentMethod = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/payment-methods/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment session");
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setSessionData(data.sessionData);
    } catch (error) {
      toast.error("Failed to initialize payment form");
      setIsAddDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentCompleted = async (result: { resultCode: string }) => {
    if (result.resultCode === "Authorised" || result.resultCode === "Pending") {
      toast.success("Payment method added successfully!");
      setIsAddDialogOpen(false);
      setSessionId(null);
      setSessionData(null);
      // Refresh payment methods
      await refreshPaymentMethods();
    } else {
      toast.error(`Failed to add payment method: ${result.resultCode}`);
    }
  };

  const handlePaymentError = (error: { message?: string }) => {
    toast.error(error?.message || "Failed to add payment method");
  };

  const refreshPaymentMethods = async () => {
    try {
      const response = await fetch("/api/payment-methods");
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data);
      }
    } catch (error) {
      console.error("Failed to refresh payment methods:", error);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    setSettingDefaultId(paymentMethodId);
    try {
      const response = await fetch(`/api/payment-methods/${paymentMethodId}/default`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to set default payment method");
      }

      toast.success("Default payment method updated");
      await refreshPaymentMethods();
    } catch (error) {
      toast.error("Failed to update default payment method");
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDelete = async (paymentMethodId: string) => {
    setDeletingId(paymentMethodId);
    try {
      const response = await fetch(`/api/payment-methods/${paymentMethodId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete payment method");
      }

      toast.success("Payment method removed");
      await refreshPaymentMethods();
    } catch (error) {
      toast.error("Failed to remove payment method");
    } finally {
      setDeletingId(null);
    }
  };

  const isCardType = (method: PaymentMethod) => method.type === "scheme" || method.type === "card";

  const isWalletType = (method: PaymentMethod) =>
    ["googlepay", "applepay", "paywithgoogle"].includes(method.type);

  const isBankType = (method: PaymentMethod) =>
    ["ach", "sepadirectdebit", "directdebit_GB", "bankTransfer"].includes(method.type);

  const getMethodIcon = (method: PaymentMethod) => {
    if (isWalletType(method)) return <Smartphone className="h-6 w-6" />;
    if (isBankType(method)) return <Landmark className="h-6 w-6" />;
    return <CreditCard className="h-6 w-6" />;
  };

  const getMethodIdentifier = (method: PaymentMethod): string => {
    if (method.lastFour && method.lastFour !== "****") {
      return `•••• ${method.lastFour}`;
    }
    if (method.holderName) return method.holderName;
    return "";
  };

  const getDeleteDescription = (method: PaymentMethod): string => {
    const label = getMethodLabel(method);
    if (method.lastFour && method.lastFour !== "****") {
      return `${label} ending in ${method.lastFour}`;
    }
    return label;
  };

  const hasExpiry = (method: PaymentMethod) =>
    isCardType(method) && method.expiryMonth && method.expiryYear;

  const parseExpiryDate = (method: PaymentMethod): Date => {
    const year = parseInt(method.expiryYear!);
    const fullYear = year < 100 ? 2000 + year : year;
    return new Date(fullYear, parseInt(method.expiryMonth!), 0);
  };

  const isExpired = (method: PaymentMethod): boolean => {
    if (!hasExpiry(method)) return false;
    return new Date() > parseExpiryDate(method);
  };

  const isExpiringSoon = (method: PaymentMethod): boolean => {
    if (!hasExpiry(method)) return false;
    const now = new Date();
    const expiryDate = parseExpiryDate(method);
    const twoMonthsFromNow = new Date();
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
    return now <= expiryDate && expiryDate <= twoMonthsFromNow;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
        <CardDescription>Manage your payment details for subscription billing</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {paymentMethods.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="font-medium">No payment methods on file</p>
              <p className="text-sm">Add a payment method to ensure uninterrupted service.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => {
              const expired = isExpired(method);
              const expiringSoon = isExpiringSoon(method);
              const identifier = getMethodIdentifier(method);

              return (
                <div
                  key={method.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    expired
                      ? "border-destructive/50 bg-destructive/5"
                      : expiringSoon
                        ? "border-amber-500/50 bg-amber-500/5"
                        : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getMethodIcon(method)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{getMethodLabel(method)}</span>
                        {identifier && <span className="text-muted-foreground">{identifier}</span>}
                        {method.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {hasExpiry(method) && (
                          <span>
                            Expires {method.expiryMonth}/{method.expiryYear!.slice(-2)}
                          </span>
                        )}
                      </div>
                      {expired && (
                        <div className="flex items-center gap-1 text-sm text-destructive mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Card expired</span>
                        </div>
                      )}
                      {expiringSoon && !expired && (
                        <div className="flex items-center gap-1 text-sm text-amber-600 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Expiring soon</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={settingDefaultId === method.id}
                      >
                        {settingDefaultId === method.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        <span className="sr-only">Set as default</span>
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingId === method.id}
                        >
                          {deletingId === method.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove payment method?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {getDeleteDescription(method)} from your account.
                            {method.isDefault &&
                              " This is your default payment method - removing it may affect your subscription."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(method.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full" onClick={handleAddPaymentMethod}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Payment Method</DialogTitle>
              <DialogDescription>
                Add a card, digital wallet, or bank account to your account.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {isLoading ? (
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
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}
