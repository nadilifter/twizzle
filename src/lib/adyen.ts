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

export const checkout = new CheckoutAPI(client);

export async function createPaymentSession(
  amount: number,
  currency: string = "USD",
  reference: string,
  returnUrl: string,
  shopperEmail?: string,
  lineItems?: any[]
) {
  try {
    const response = await checkout.sessions({
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
