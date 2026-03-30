import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function ReceiptPage({
  params,
}: {
  params: { slug: string; invoiceId: string };
}) {
  const subdomain = params.slug;
  const invoiceId = params.invoiceId;

  const config = await db.websiteConfig.findUnique({
    where: { subdomain },
    select: { organizationId: true },
  });

  if (!config) return notFound();

  const invoice = await db.invoice.findUnique({
    where: {
      id: invoiceId,
      organizationId: config.organizationId,
    },
    include: {
      lineItems: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!invoice) return notFound();

  // Determine status display
  const isPaid = invoice.status === "PAID";
  // Since we don't have real-time webhook updates in this dev environment,
  // we might see DRAFT even if paid in test mode.
  // In a real flow, the webhook would update the status before redirect or shortly after.

  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Order Received</h1>
          <p className="text-muted-foreground mt-2">
            Thank you, {invoice.user?.name?.split(" ")[0] ?? "there"}!
          </p>
          <p className="text-sm text-muted-foreground">
            Your order reference is{" "}
            <span className="font-mono text-foreground">{invoice.reference}</span>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoice.lineItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{item.description}</span>
                  <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                </div>
                <span>${Number(item.total).toFixed(2)}</span>
              </div>
            ))}

            <Separator />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.tax) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${Number(invoice.tax).toFixed(2)}</span>
                </div>
              )}
              {Number(invoice.processingFee) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing Fee</span>
                  <span>${Number(invoice.processingFee).toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${Number(invoice.total).toFixed(2)}</span>
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
