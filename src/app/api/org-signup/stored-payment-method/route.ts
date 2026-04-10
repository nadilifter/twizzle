import { NextRequest, NextResponse } from "next/server";
import { getStoredPaymentMethodsWithRetry, isAdyenConfigured } from "@/lib/adyen";

export async function GET(request: NextRequest) {
  const shopperReference = request.nextUrl.searchParams.get("shopperReference");

  if (!shopperReference) {
    return NextResponse.json({ error: "shopperReference is required" }, { status: 400 });
  }

  if (!isAdyenConfigured()) {
    return NextResponse.json({ error: "Payment processing is not configured" }, { status: 503 });
  }

  try {
    const methods = await getStoredPaymentMethodsWithRetry(shopperReference);
    const first = methods[0];

    if (!first) {
      return NextResponse.json({ lastFour: null, brand: null });
    }

    return NextResponse.json({ lastFour: first.lastFour, brand: first.brand ?? first.type });
  } catch (error) {
    console.error("Error fetching stored payment method:", error);
    return NextResponse.json({ lastFour: null, brand: null });
  }
}
