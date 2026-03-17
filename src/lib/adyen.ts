/**
 * Adyen Payment Integration
 * 
 * Environment variables:
 *   - ADYEN_API_KEY: Your Adyen API key
 *   - ADYEN_MERCHANT_ACCOUNT: Your Adyen merchant account name
 *   - ADYEN_ENVIRONMENT: "TEST" or "LIVE" (defaults to TEST in development, required in production)
 *   - ADYEN_WEBHOOK_HMAC_KEY: HMAC key for webhook signature verification
 */

// Lazy initialization to avoid build-time errors
// Adyen client types are only available at runtime via require(), so we use any here
let _checkoutApi: any = null; // CheckoutAPI
let _recurringApi: any = null; // RecurringAPI
let _adyenEnvironmentName: "TEST" | "LIVE" = "TEST";
let _adyenClient: any = null; // Client

/**
 * Check if Adyen is properly configured
 */
export function isAdyenConfigured(): boolean {
  return !!(process.env.ADYEN_API_KEY && process.env.ADYEN_MERCHANT_ACCOUNT);
}

function getAdyenClient() {
  if (_adyenClient) {
    return _adyenClient;
  }

  // Check if Adyen is configured before trying to load the library
  if (!isAdyenConfigured()) {
    console.warn("ADYEN_API_KEY or ADYEN_MERCHANT_ACCOUNT is not set - Adyen payments will not work");
    throw new Error("Adyen is not configured. Please set ADYEN_API_KEY and ADYEN_MERCHANT_ACCOUNT environment variables.");
  }

  // Only initialize when actually needed
  const { Client, EnvironmentEnum: Environment } = require("@adyen/api-library");

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

  _adyenClient = new Client({
    apiKey: process.env.ADYEN_API_KEY,
    environment: adyenEnvironment,
  });

  return _adyenClient;
}

function getCheckoutApi() {
  if (_checkoutApi) {
    return _checkoutApi;
  }

  const { CheckoutAPI } = require("@adyen/api-library");
  _checkoutApi = new CheckoutAPI(getAdyenClient());
  return _checkoutApi;
}

function getRecurringApi() {
  if (_recurringApi) {
    return _recurringApi;
  }

  const { RecurringAPI } = require("@adyen/api-library");
  _recurringApi = new RecurringAPI(getAdyenClient());
  return _recurringApi;
}

// Export a getter instead of the instance directly
export const checkoutApi = {
  get PaymentsApi() {
    return getCheckoutApi().PaymentsApi;
  },
  get PaymentLinksApi() {
    return getCheckoutApi().PaymentLinksApi;
  },
  get RecurringApi() {
    // RecurringAPI wrapper exposes the actual RecurringApi (with disable(), etc.) as a getter
    return getRecurringApi().RecurringApi;
  },
};

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
      channel: "Web" as any,
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
      ...(expiresAt && { expiresAt: new Date(expiresAt) }),
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

// ============================================
// Tokenization & Recurring Payment Functions
// ============================================

/**
 * Stored payment method type returned from Adyen
 */
export interface StoredPaymentMethod {
  id: string;  // storedPaymentMethodId
  type: string;  // "scheme", "sepadirectdebit", etc.
  brand?: string;  // "visa", "mc", "amex"
  lastFour: string;
  expiryMonth?: string;
  expiryYear?: string;
  holderName?: string;
  name?: string;  // Display name from Adyen
}

/**
 * Create a session for tokenizing a payment method (storing card for recurring payments)
 * Used during organization signup for paid plans
 * 
 * @param shopperReference - Unique identifier for the organization in Adyen
 * @param returnUrl - URL to redirect after payment/tokenization
 * @param shopperEmail - Optional shopper email
 * @param amount - Amount in dollars (use 0 for $0 authorization)
 */
export async function createTokenizationSession(
  shopperReference: string,
  returnUrl: string,
  shopperEmail?: string,
  amount: number = 0
) {
  try {
    const response = await checkoutApi.PaymentsApi.sessions({
      amount: { 
        currency: "USD", 
        value: Math.round(amount * 100)  // Amount in minor units
      },
      reference: `token-${shopperReference}-${Date.now()}`,
      returnUrl,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT || "TestMerchant",
      shopperReference,
      shopperEmail,
      channel: "Web" as any,
      countryCode: "US",
      // Enable tokenization
      storePaymentMethod: true,
      storePaymentMethodMode: "askForConsent" as any,  // Shows checkbox to save card
      recurringProcessingModel: "Subscription" as any,
      // Allow multiple payment methods to be stored
      shopperInteraction: "Ecommerce" as any,
    });
    return response;
  } catch (error) {
    console.error("Error creating Adyen tokenization session:", error);
    throw error;
  }
}

/**
 * Get stored payment methods for a shopper
 * 
 * @param shopperReference - The unique shopper reference (organization ID)
 */
export async function getStoredPaymentMethods(
  shopperReference: string
): Promise<StoredPaymentMethod[]> {
  try {
    // Use the Checkout API's paymentMethods endpoint with shopperReference
    // This returns stored payment methods for the shopper
    const response = await checkoutApi.PaymentsApi.paymentMethods({
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT || "TestMerchant",
      shopperReference,
      channel: "Web" as any,
    });

    // Transform stored payment methods from the response
    const storedMethods: StoredPaymentMethod[] = [];
    
    if (response.storedPaymentMethods) {
      for (const method of response.storedPaymentMethods) {
        storedMethods.push({
          id: method.id || "",
          type: method.type || "unknown",
          brand: method.brand,
          lastFour: method.lastFour || "",
          expiryMonth: method.expiryMonth,
          expiryYear: method.expiryYear,
          holderName: method.holderName,
          name: method.name,
        });
      }
    }

    return storedMethods;
  } catch (error) {
    console.error("Error getting stored payment methods:", error);
    throw error;
  }
}

/**
 * Disable (delete) a stored payment method
 * 
 * @param shopperReference - The unique shopper reference (organization ID)
 * @param storedPaymentMethodId - The ID of the stored payment method to disable
 */
export async function disableStoredPaymentMethod(
  shopperReference: string,
  storedPaymentMethodId: string
): Promise<void> {
  try {
    // Use the Recurring API to disable stored payment details
    await checkoutApi.RecurringApi.disable({
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT || "TestMerchant",
      shopperReference,
      recurringDetailReference: storedPaymentMethodId,
    });
  } catch (error) {
    console.error("Error disabling stored payment method:", error);
    throw error;
  }
}

/**
 * Charge a subscription using a stored payment token
 * 
 * @param shopperReference - The unique shopper reference (organization ID)
 * @param storedPaymentMethodId - The ID of the stored payment method to charge
 * @param amount - Amount in dollars
 * @param reference - Unique payment reference
 * @param description - Optional payment description
 */
export async function chargeSubscription(
  shopperReference: string,
  storedPaymentMethodId: string,
  amount: number,
  reference: string,
  description?: string
) {
  try {
    const response = await checkoutApi.PaymentsApi.payments({
      amount: { 
        currency: "USD", 
        value: Math.round(amount * 100)  // Amount in minor units
      },
      reference,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT || "TestMerchant",
      shopperReference,
      paymentMethod: {
        type: "scheme" as any,
        storedPaymentMethodId,
      },
      shopperInteraction: "ContAuth" as any,  // Continuous authorization (recurring)
      recurringProcessingModel: "Subscription" as any,
      // Optional metadata
      ...(description && { 
        metadata: { description } 
      }),
    });

    return response;
  } catch (error) {
    console.error("Error charging subscription:", error);
    throw error;
  }
}

/**
 * Verify Adyen webhook HMAC signature
 * 
 * @param payload - The raw request body as a string
 * @param hmacSignature - The HMAC signature from the request headers
 */
export function verifyWebhookSignature(
  payload: string,
  hmacSignature: string
): boolean {
  const hmacKey = process.env.ADYEN_WEBHOOK_HMAC_KEY;
  if (!hmacKey) {
    console.error("ADYEN_WEBHOOK_HMAC_KEY is not set - cannot verify webhook signature");
    return false;
  }

  try {
    const { hmacValidator } = require("@adyen/api-library");
    const validator = new hmacValidator();
    
    // Parse the notification item from the payload
    const notificationRequest = JSON.parse(payload);
    const notificationItem = notificationRequest.notificationItems?.[0]?.NotificationRequestItem;
    
    if (!notificationItem) {
      console.error("Invalid webhook payload - no notification item found");
      return false;
    }

    return validator.validateHMAC(notificationItem, hmacKey);
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Parse webhook notification for recurring token events
 * 
 * @param payload - The raw webhook payload
 */
export interface TokenWebhookData {
  eventCode: string;
  pspReference: string;
  shopperReference: string;
  storedPaymentMethodId?: string;
  paymentMethod?: {
    type?: string;
    brand?: string;
    lastFour?: string;
    expiryMonth?: string;
    expiryYear?: string;
    holderName?: string;
  };
  success: boolean;
}

export function parseRecurringTokenWebhook(payload: string): TokenWebhookData | null {
  try {
    const notificationRequest = JSON.parse(payload);
    const notificationItem = notificationRequest.notificationItems?.[0]?.NotificationRequestItem;
    
    if (!notificationItem) {
      return null;
    }

    const additionalData = notificationItem.additionalData || {};

    return {
      eventCode: notificationItem.eventCode,
      pspReference: notificationItem.pspReference,
      shopperReference: additionalData["recurring.shopperReference"] || "",
      storedPaymentMethodId: additionalData["recurring.recurringDetailReference"],
      paymentMethod: {
        type: notificationItem.paymentMethod,
        brand: additionalData.cardBin ? additionalData.cardPaymentMethod : notificationItem.paymentMethod,
        lastFour: additionalData.cardSummary,
        expiryMonth: additionalData.expiryDate?.split("/")[0],
        expiryYear: additionalData.expiryDate?.split("/")[1] ? `20${additionalData.expiryDate.split("/")[1]}` : undefined,
        holderName: additionalData.cardHolderName,
      },
      success: notificationItem.success === "true" || notificationItem.success === true,
    };
  } catch (error) {
    console.error("Error parsing recurring token webhook:", error);
    return null;
  }
}
