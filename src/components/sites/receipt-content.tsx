"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ReceiptLineItem {
  id: string;
  description: string;
  quantity: number;
  total: number;
}

interface ReceiptData {
  id: string;
  reference: string;
  status: string;
  postPaymentProcessed: boolean;
  subtotal: number;
  tax: number;
  total: number;
  userName: string | null;
  lineItems: ReceiptLineItem[];
}

const MAX_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

export function ReceiptContent({
  slug,
  invoiceId,
  resultCode,
}: {
  slug: string;
  invoiceId: string;
  resultCode: string;
}) {
  // Pending and Received resultCode means payment was ACH
  const isAsyncPayment = resultCode === "Pending" || resultCode === "Received";

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReceipt = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/sites/${slug}/receipt/${invoiceId}`);
      if (res.ok) {
        const data: ReceiptData = await res.json();
        // Async payments (ACH): show order details immediately without waiting for webhook
        // Sync payments (card/wallet): wait until postPaymentProcessed = true
        if (isAsyncPayment || data.postPaymentProcessed) {
          setReceipt(data);
          setLoading(false);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, [slug, invoiceId, isAsyncPayment]);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function poll() {
      // For async payments, a single fetch is enough — no need to wait for the webhook
      const maxAttempts = isAsyncPayment ? 1 : MAX_ATTEMPTS;

      while (!cancelled && attempt < maxAttempts) {
        const found = await fetchReceipt();
        if (found || cancelled) return;
        attempt++;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (!cancelled) {
        setFailed(true);
        setLoading(false);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [fetchReceipt, isAsyncPayment]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center">
        <div className="max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Confirming your payment&hellip;</h1>
          <p className="text-muted-foreground mt-2">This should only take a moment.</p>
        </div>
      </div>
    );
  }

  if (failed || !receipt) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Receipt unavailable</h1>
          <p className="text-muted-foreground mt-2">
            We couldn&apos;t load your receipt right now. If you completed a payment, you&apos;ll
            receive a confirmation email shortly.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const firstName = receipt.userName?.split(" ")[0] ?? "there";

  // ACH / async payment — payment submitted but not yet confirmed by bank
  if (isAsyncPayment) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Clock className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold">Payment Submitted</h1>
            <p className="text-muted-foreground mt-2">Thank you, {firstName}!</p>
            <p className="text-sm text-muted-foreground mt-1">
              ACH bank transfers take 1–3 business days to confirm. We&apos;ll send you a
              confirmation email once your payment clears.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Order reference:{" "}
                <span className="font-mono text-foreground">{receipt.reference}</span>
              </p>
              {receipt.lineItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{item.description}</span>
                    <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                  </div>
                  <span>${item.total.toFixed(2)}</span>
                </div>
              ))}

              <Separator />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${receipt.subtotal.toFixed(2)}</span>
                </div>
                {receipt.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${receipt.tax.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${receipt.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link href="/">Return to Home</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Sync payment — webhook confirmed, show full receipt
  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Order Confirmed</h1>
          <p className="text-muted-foreground mt-2">Thank you, {firstName}!</p>
          <p className="text-sm text-muted-foreground">
            Your order reference is{" "}
            <span className="font-mono text-foreground">{receipt.reference}</span>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {receipt.lineItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{item.description}</span>
                  <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                </div>
                <span>${item.total.toFixed(2)}</span>
              </div>
            ))}

            <Separator />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${receipt.subtotal.toFixed(2)}</span>
              </div>
              {receipt.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${receipt.tax.toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${receipt.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" asChild>
              <Link href="/">Return to Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
