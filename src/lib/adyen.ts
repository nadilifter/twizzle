import { Client, CheckoutAPI, Environment } from "@adyen/api-library";

/**
 * Adyen Payment Integration
 * 
 * Environment variables:
 *   - ADYEN_API_KEY: Your Adyen API key
 *   - ADYEN_MERCHANT_ACCOUNT: Your Adyen merchant account name
 *   - ADYEN_ENVIRONMENT: "TEST" or "LIVE" (defaults to TEST in development, required in production)
 */

// Validate required configuration
if (!process.env.ADYEN_API_KEY) {
  console.warn("ADYEN_API_KEY is not set - Adyen payments will not work");
}

if (!process.env.ADYEN_MERCHANT_ACCOUNT) {
  console.warn("ADYEN_MERCHANT_ACCOUNT is not set - Adyen payments will not work");
}

// Determine Adyen environment from env var
// In production, require explicit configuration
// In development, default to TEST
function getAdyenEnvironment(): Environment {
  const envValue = process.env.ADYEN_ENVIRONMENT?.toUpperCase();
  
  if (envValue === "LIVE") {
    return Environment.LIVE;
  }
  
  if (envValue === "TEST") {
    return Environment.TEST;
  }
  
  // If not explicitly set
  if (process.env.NODE_ENV === "production") {
    // In production, warn if not set but default to TEST for safety
    console.warn(
      "ADYEN_ENVIRONMENT is not set in production! " +
      "Set to 'LIVE' for production payments or 'TEST' for sandbox. " +
      "Defaulting to TEST for safety."
    );
    return Environment.TEST;
  }
  
  // In development, default to TEST
  return Environment.TEST;
}

const adyenEnvironment = getAdyenEnvironment();

// Log environment in development
if (process.env.NODE_ENV === "development") {
  console.log(`Adyen initialized in ${adyenEnvironment} mode`);
}

const client = new Client({
  apiKey: process.env.ADYEN_API_KEY || "",
  environment: adyenEnvironment,
});

export const checkoutApi = new CheckoutAPI(client);

/**
 * Check if Adyen is properly configured
 */
export function isAdyenConfigured(): boolean {
  return !!(process.env.ADYEN_API_KEY && process.env.ADYEN_MERCHANT_ACCOUNT);
}

/**
 * Get current Adyen environment
 */
export function getAdyenEnvironmentName(): "TEST" | "LIVE" {
  return adyenEnvironment === Environment.LIVE ? "LIVE" : "TEST";
}

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
