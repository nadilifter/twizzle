"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
  subtotal: number;
  tax: number;
  total: number;
  userName: string | null;
  lineItems: ReceiptLineItem[];
}

const MAX_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

export function ReceiptContent({ slug, invoiceId }: { slug: string; invoiceId: string }) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReceipt = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${slug}/receipt/${invoiceId}`);
      if (res.ok) {
        const data: ReceiptData = await res.json();
        setReceipt(data);
        setLoading(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [slug, invoiceId]);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function poll() {
      while (!cancelled && attempt < MAX_ATTEMPTS) {
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
  }, [fetchReceipt]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center">
        <div className="max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Preparing your receipt&hellip;</h1>
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

  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Order Received</h1>
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
