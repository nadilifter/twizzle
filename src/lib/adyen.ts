/**
 * Adyen Payment Integration
 * 
 * Environment variables:
 *   - ADYEN_API_KEY: Your Adyen API key
 *   - ADYEN_MERCHANT_ACCOUNT: Your Adyen merchant account name
 *   - ADYEN_ENVIRONMENT: "TEST" or "LIVE" (defaults to TEST in development, required in production)
 */

// Lazy initialization to avoid build-time errors
let _checkoutApi: import("@adyen/api-library").CheckoutAPI | null = null;
let _adyenEnvironmentName: "TEST" | "LIVE" = "TEST";

function getCheckoutApi() {
  if (_checkoutApi) {
    return _checkoutApi;
  }

  // Only initialize when actually needed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client, CheckoutAPI, Environment } = require("@adyen/api-library");

  // Validate required configuration
  if (!process.env.ADYEN_API_KEY) {
    console.warn("ADYEN_API_KEY is not set - Adyen payments will not work");
  }

  if (!process.env.ADYEN_MERCHANT_ACCOUNT) {
    console.warn("ADYEN_MERCHANT_ACCOUNT is not set - Adyen payments will not work");
  }

  // Determine Adyen environment from env var
  const envValue = process.env.ADYEN_ENVIRONMENT?.toUpperCase();
  let adyenEnvironment;
  
  if (envValue === "LIVE") {
    adyenEnvironment = Environment.LIVE;
    _adyenEnvironmentName = "LIVE";
  } else if (envValue === "TEST") {
    adyenEnvironment = Environment.TEST;
    _adyenEnvironmentName = "TEST";
  } else {
    // If not explicitly set
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "ADYEN_ENVIRONMENT is not set in production! " +
        "Set to 'LIVE' for production payments or 'TEST' for sandbox. " +
        "Defaulting to TEST for safety."
      );
    }
    adyenEnvironment = Environment.TEST;
    _adyenEnvironmentName = "TEST";
  }

  const client = new Client({
    apiKey: process.env.ADYEN_API_KEY || "",
    environment: adyenEnvironment,
  });

  _checkoutApi = new CheckoutAPI(client);
  return _checkoutApi;
}

// Export a getter instead of the instance directly
export const checkoutApi = {
  get PaymentsApi() {
    return getCheckoutApi().PaymentsApi;
  },
  get PaymentLinksApi() {
    return getCheckoutApi().PaymentLinksApi;
  },
};

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
  // If not initialized yet, determine from env var
  const envValue = process.env.ADYEN_ENVIRONMENT?.toUpperCase();
  if (envValue === "LIVE") return "LIVE";
  return "TEST";
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
