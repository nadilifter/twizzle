"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCart } from "@/components/sites/cart-context";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  CreditCard,
  Banknote,
  QrCode,
  XCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type PaymentStatus = "idle" | "generating" | "waiting" | "completed" | "failed" | "processing";

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMethod = searchParams.get("method") as "cash" | "card" | null;

  const { items, subtotal, clearCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">(initialMethod || "card");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [paymentLinkId, setPaymentLinkId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState(0);
  const [taxPaidBy, setTaxPaidBy] = useState<"CUSTOMER" | "ORGANIZATION">("CUSTOMER");
  const [processingFeePaidBy, setProcessingFeePaidBy] = useState<"CUSTOMER" | "ORGANIZATION">(
    "CUSTOMER"
  );
  const [planTransactionFee, setPlanTransactionFee] = useState(0);
  const [planPerTransactionFee, setPlanPerTransactionFee] = useState(0);

  useEffect(() => {
    fetch("/api/organization/taxes-and-fees")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.taxEnabled !== false && data.taxRate != null) {
          setTaxRate(Number(data.taxRate));
        }
        if (data.taxPaidBy) setTaxPaidBy(data.taxPaidBy);
        if (data.processingFeePaidBy) setProcessingFeePaidBy(data.processingFeePaidBy);
        if (data.plan) {
          setPlanTransactionFee(data.plan.transactionFee);
          setPlanPerTransactionFee(data.plan.perTransactionFee);
        }
      })
      .catch((err) => console.error("Failed to load tax/fee settings:", err));
  }, []);

  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const feeBase = taxPaidBy === "CUSTOMER" ? subtotal + tax : subtotal;
  const processingFeeRaw = feeBase > 0 ? feeBase * planTransactionFee + planPerTransactionFee : 0;
  const processingFee = Math.round(processingFeeRaw * 100) / 100;

  let total = subtotal;
  if (taxPaidBy === "CUSTOMER") total += tax;
  if (processingFeePaidBy === "CUSTOMER") total += processingFee;
  total = Math.round(total * 100) / 100;

  // Generate payment link for card payments
  const generatePaymentLink = useCallback(async () => {
    if (items.length === 0) return;

    setPaymentStatus("generating");
    setError(null);

    try {
      const reference = `POS-${Date.now()}`;
      const response = await fetch("/api/pos/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          currency: "USD",
          reference,
          description: `POS Sale - ${items.length} items`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create payment link");
      }

      const data = await response.json();
      setPaymentLinkUrl(data.url);
      setPaymentLinkId(data.id);
      setPaymentStatus("waiting");
    } catch (err) {
      console.error("Error generating payment link:", err);
      setError(err instanceof Error ? err.message : "Failed to generate payment link");
      setPaymentStatus("failed");
    }
  }, [items.length, total]);

  // Poll for payment status
  useEffect(() => {
    if (paymentStatus !== "waiting" || !paymentLinkId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/pos/payment-link?id=${paymentLinkId}`);
        if (response.ok) {
          const data = await response.json();
          // Check if payment is completed (status varies by Adyen - could be "completed", "paid", etc.)
          if (data.status === "completed" || data.status === "paid") {
            setPaymentStatus("processing");
            clearInterval(pollInterval);
            // Process the checkout
            await processCheckout("CARD");
          }
        }
      } catch (err) {
        console.error("Error polling payment status:", err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [paymentStatus, paymentLinkId]);

  // Auto-generate payment link for card payments
  useEffect(() => {
    if (paymentMethod === "card" && paymentStatus === "idle" && items.length > 0) {
      generatePaymentLink();
    }
  }, [paymentMethod, paymentStatus, items.length, generatePaymentLink]);

  // Process checkout
  const processCheckout = async (method: "CARD" | "CASH") => {
    setPaymentStatus("processing");
    setError(null);

    try {
      const response = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            referenceId: item.referenceId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            details: item.details,
          })),
          paymentMethod: method,
          paymentLinkId: method === "CARD" ? paymentLinkId : undefined,
          subtotal,
          tax,
          total,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process checkout");
      }

      const data = await response.json();
      setInvoiceId(data.invoiceId);
      setPaymentStatus("completed");
      clearCart();
      toast.success("Payment completed successfully!");
    } catch (err) {
      console.error("Error processing checkout:", err);
      setError(err instanceof Error ? err.message : "Failed to process checkout");
      setPaymentStatus("failed");
    }
  };

  // Handle cash payment
  const handleCashPayment = () => {
    processCheckout("CASH");
  };

  // Reset and try again
  const handleRetry = () => {
    setPaymentStatus("idle");
    setPaymentLinkUrl(null);
    setPaymentLinkId(null);
    setError(null);
    if (paymentMethod === "card") {
      generatePaymentLink();
    }
  };

  // If no items in cart, redirect back
  if (items.length === 0 && paymentStatus !== "completed") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Cart is Empty</CardTitle>
            <CardDescription>Add items to your cart before checkout</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/pos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to POS
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      {/* Left: Payment Options */}
      <div className="flex-1 flex items-center justify-center p-8">
        {paymentStatus === "completed" ? (
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-500" />
              </div>
              <CardTitle className="text-2xl">Payment Successful!</CardTitle>
              <CardDescription>Order #{invoiceId?.slice(-8)} has been completed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">${total.toFixed(2)}</div>
              <Button asChild className="w-full" size="lg">
                <Link href="/pos">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  New Order
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : paymentStatus === "failed" ? (
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-600 dark:text-red-500" />
              </div>
              <CardTitle className="text-2xl">Payment Failed</CardTitle>
              <CardDescription className="text-destructive">
                {error || "Something went wrong"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleRetry} className="w-full" size="lg">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/pos">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to POS
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : paymentStatus === "processing" ? (
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl">Processing Payment...</CardTitle>
              <CardDescription>Please wait while we complete your transaction</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="w-full max-w-lg space-y-6">
            {/* Payment Method Toggle */}
            <div className="flex gap-4">
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                className="flex-1 h-14"
                onClick={() => {
                  setPaymentMethod("card");
                  if (paymentStatus === "idle") {
                    generatePaymentLink();
                  }
                }}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                Card
              </Button>
              <Button
                variant={paymentMethod === "cash" ? "default" : "outline"}
                className="flex-1 h-14"
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote className="mr-2 h-5 w-5" />
                Cash
              </Button>
            </div>

            {/* Payment Content */}
            {paymentMethod === "card" ? (
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Scan to Pay
                  </CardTitle>
                  <CardDescription>
                    Customer scans this QR code with their phone to pay
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  {paymentStatus === "generating" ? (
                    <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                      <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                    </div>
                  ) : paymentLinkUrl ? (
                    <>
                      <div className="p-4 bg-white rounded-lg shadow-inner border">
                        <QRCodeSVG value={paymentLinkUrl} size={240} level="H" includeMargin />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        Waiting for payment...
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking payment status
                      </div>
                    </>
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                      <p className="text-muted-foreground">No payment link</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Cash Payment
                  </CardTitle>
                  <CardDescription>Collect ${total.toFixed(2)} from the customer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="text-5xl font-bold">${total.toFixed(2)}</div>
                    <p className="text-sm text-muted-foreground mt-2">Amount Due</p>
                  </div>
                  <Button onClick={handleCashPayment} className="w-full h-12" size="lg">
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Complete Cash Payment
                  </Button>
                </CardContent>
              </Card>
            )}

            <Button asChild variant="ghost" className="w-full">
              <Link href="/pos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel and Return
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Right: Order Summary */}
      {paymentStatus !== "completed" && (
        <div className="w-[320px] bg-muted/30 border-l p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

          <div className="flex-1 overflow-y-auto space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 mt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {taxPaidBy === "CUSTOMER" && tax > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({(taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            )}
            {processingFeePaidBy === "CUSTOMER" && processingFee > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Processing Fee</span>
                <span>${processingFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold pt-2 border-t">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}
