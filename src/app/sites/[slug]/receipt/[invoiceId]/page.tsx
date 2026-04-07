import { ReceiptContent } from "@/components/sites/receipt-content";

export default function ReceiptPage({ params }: { params: { slug: string; invoiceId: string } }) {
  return <ReceiptContent slug={params.slug} invoiceId={params.invoiceId} />;
}
