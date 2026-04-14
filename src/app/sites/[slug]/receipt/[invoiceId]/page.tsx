import { ReceiptContent } from "@/components/sites/receipt-content";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; invoiceId: string }>;
  searchParams: Promise<{ rc?: string }>;
}) {
  const { slug, invoiceId } = await params;
  const { rc } = await searchParams;
  return <ReceiptContent slug={slug} invoiceId={invoiceId} resultCode={rc ?? "Authorised"} />;
}
