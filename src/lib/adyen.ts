import { Client, CheckoutAPI } from "@adyen/api-library";

if (!process.env.ADYEN_API_KEY) {
  console.warn("ADYEN_API_KEY is not set");
}

if (!process.env.ADYEN_MERCHANT_ACCOUNT) {
  console.warn("ADYEN_MERCHANT_ACCOUNT is not set");
}

const client = new Client({
  apiKey: process.env.ADYEN_API_KEY || "TEST_KEY",
  environment: "TEST", // or "LIVE"
});

export const checkoutApi = new CheckoutAPI(client);

export async function createPaymentSession(
  amount: number,
  currency: string = "USD",
  reference: string,
  returnUrl: string,
  shopperEmail?: string,
  lineItems?: any[]
) {
  try {
    // In @adyen/api-library v30+, use PaymentsApi.sessions() instead of checkout.sessions()
    const response = await checkoutApi.PaymentsApi.sessions({
      amount: { currency, value: Math.round(amount * 100) }, // Amount in minor units
      reference,
      returnUrl,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT || "TestMerchant",
      shopperEmail,
      lineItems,
      channel: "Web",
      countryCode: "US", // Should be dynamic
    });
    return response;
  } catch (error) {
    console.error("Error creating Adyen session:", error);
    throw error;
  }
}

export async function createPaymentLink(
  amount: number,
  currency: string = "USD",
  reference: string,
  description?: string,
  expiresAt?: string
) {
  try {
    const response = await checkoutApi.PaymentLinksApi.paymentLinks({
      amount: { currency, value: Math.round(amount * 100) }, // Amount in minor units
      reference,
      description: description || `Payment for order ${reference}`,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT || "TestMerchant",
      countryCode: "US",
      // Optional: Set expiration (default is usually 24 hours)
      ...(expiresAt && { expiresAt }),
    });
    return response;
  } catch (error) {
    console.error("Error creating Adyen payment link:", error);
    throw error;
  }
}

export async function getPaymentLink(linkId: string) {
  try {
    const response = await checkoutApi.PaymentLinksApi.getPaymentLink(linkId);
    return response;
  } catch (error) {
    console.error("Error getting Adyen payment link:", error);
    throw error;
  }
}
