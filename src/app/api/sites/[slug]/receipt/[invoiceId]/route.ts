import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { getSubdomainUrl } from "@/lib/env-domains";

// tenant-isolation-ok: public receipt page uses subdomain to scope by org
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; invoiceId: string }> }
) {
  const { slug, invoiceId } = await params;

  const config = await db.websiteConfig.findUnique({
    where: { subdomain: slug },
    select: { organizationId: true },
  });

  if (!config) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const invoice = await db.invoice.findUnique({
    where: {
      id: invoiceId,
      organizationId: config.organizationId,
    },
    include: {
      lineItems: true,
      user: { select: { name: true, email: true, passwordHash: true, status: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const sessionUserId = (await getAuthSession())?.user?.id ?? null;
  const promptLogin =
    !!invoice.user &&
    !!invoice.user.passwordHash &&
    invoice.user.status === "ACTIVE" &&
    sessionUserId !== invoice.userId;

  return NextResponse.json({
    id: invoice.id,
    reference: invoice.reference,
    status: invoice.status,
    postPaymentProcessed: invoice.postPaymentProcessed,
    subtotal: Number(invoice.subtotal),
    tax: Number(invoice.tax),
    total: Number(invoice.total),
    userName: invoice.user?.name ?? null,
    lineItems: invoice.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      total: Number(item.total),
    })),
    promptLogin,
    loginUrl: promptLogin
      ? `${getSubdomainUrl("login")}/login?email=${encodeURIComponent(invoice.user!.email)}`
      : null,
    loginEmail: promptLogin ? (invoice.user?.email ?? null) : null,
  });
}
