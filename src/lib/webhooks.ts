/**
 * Webhook Management Utilities
 * 
 * This module provides environment-aware webhook URL management and
 * signature verification utilities for external service webhooks.
 */

import { getEnvConfig, getCurrentEnvironment } from './env-domains';
import crypto from 'crypto';
import { logger } from './logger';

/**
 * Get the base URL for webhooks in the current environment
 */
export function getWebhookBaseUrl(): string {
  const config = getEnvConfig();
  const currentEnv = getCurrentEnvironment();

  if (currentEnv === 'local') {
    // Use ngrok tunnel URL for local development if configured
    return process.env.WEBHOOK_TUNNEL_URL || 'http://localhost:3000';
  }

  // For cloud environments, use the admin subdomain
  const protocol = config.useHttps ? 'https' : 'http';
  return `${protocol}://admin.${config.baseDomain}`;
}

/**
 * Webhook endpoints for all services
 */
export const WEBHOOK_ENDPOINTS = {
  /** Adyen payment webhook endpoint */
  adyen: () => `${getWebhookBaseUrl()}/api/webhooks/adyen`,
  
  /** Twilio SMS/messaging webhook endpoint */
  twilio: () => `${getWebhookBaseUrl()}/api/twilio/webhook`,
  
  /** Stripe payment webhook endpoint */
  stripe: () => `${getWebhookBaseUrl()}/api/webhooks/stripe`,
  
  /** SES bounce/complaint notification endpoint */
  sesBounce: () => `${getWebhookBaseUrl()}/api/webhooks/ses-bounce`,
  
  /** Twilio status callback endpoint */
  twilioStatus: () => `${getWebhookBaseUrl()}/api/twilio/webhook`,
} as const;

/**
 * Adyen HMAC signature verification
 */
export function verifyAdyenSignature(
  payload: string,
  signature: string,
  hmacKey?: string
): boolean {
  const key = hmacKey || process.env.ADYEN_WEBHOOK_HMAC_KEY;
  
  if (!key) {
    logger.warn('[WEBHOOK] Adyen HMAC key not configured');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', Buffer.from(key, 'hex'))
      .update(payload, 'utf-8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('[WEBHOOK] Adyen signature verification failed', { error });
    return false;
  }
}

/**
 * Twilio signature verification
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken?: string
): boolean {
  const token = authToken || process.env.TWILIO_AUTH_TOKEN;
  
  if (!token) {
    logger.warn('[WEBHOOK] Twilio auth token not configured');
    return false;
  }

  try {
    // Sort parameters alphabetically and concatenate
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], '');

    const expectedSignature = crypto
      .createHmac('sha1', token)
      .update(url + sortedParams)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('[WEBHOOK] Twilio signature verification failed', { error });
    return false;
  }
}

/**
 * Stripe signature verification
 */
export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret?: string
): boolean {
  const webhookSecret = secret || process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    logger.warn('[WEBHOOK] Stripe webhook secret not configured');
    return false;
  }

  try {
    // Parse the signature header
    const sigParts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = sigParts['t'];
    const expectedSignature = sigParts['v1'];

    if (!timestamp || !expectedSignature) {
      return false;
    }

    // Check timestamp is within tolerance (5 minutes)
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (timestampAge > 300) {
      logger.warn('[WEBHOOK] Stripe webhook timestamp too old', { timestampAge });
      return false;
    }

    // Calculate expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(computedSignature)
    );
  } catch (error) {
    logger.error('[WEBHOOK] Stripe signature verification failed', { error });
    return false;
  }
}

/**
 * Generic webhook logging helper
 */
export function logWebhookEvent(
  service: string,
  eventType: string,
  success: boolean,
  details?: Record<string, unknown>
): void {
  const logData = {
    service,
    eventType,
    success,
    environment: getCurrentEnvironment(),
    ...details,
  };

  if (success) {
    logger.info(`[WEBHOOK] ${service} event processed`, logData);
  } else {
    logger.error(`[WEBHOOK] ${service} event failed`, logData);
  }
}

/**
 * Get configuration instructions for setting up webhooks
 * Useful for displaying in admin UI
 */
export function getWebhookSetupInstructions(): Record<string, { url: string; instructions: string }> {
  const currentEnv = getCurrentEnvironment();
  
  return {
    adyen: {
      url: WEBHOOK_ENDPOINTS.adyen(),
      instructions: `
1. Go to Adyen Customer Area (${currentEnv === 'production' ? 'ca-live' : 'ca-test'}.adyen.com)
2. Navigate to Developers > Webhooks
3. Create a new webhook with URL: ${WEBHOOK_ENDPOINTS.adyen()}
4. Set up HMAC signature verification
5. Copy the HMAC key to ADYEN_WEBHOOK_HMAC_KEY environment variable
      `.trim(),
    },
    twilio: {
      url: WEBHOOK_ENDPOINTS.twilio(),
      instructions: `
1. Go to Twilio Console (console.twilio.com)
2. Navigate to Phone Numbers > Manage > Active Numbers
3. Select your phone number
4. Set the webhook URL for incoming messages: ${WEBHOOK_ENDPOINTS.twilio()}
5. Set the status callback URL: ${WEBHOOK_ENDPOINTS.twilioStatus()}
      `.trim(),
    },
    stripe: {
      url: WEBHOOK_ENDPOINTS.stripe(),
      instructions: `
1. Go to Stripe Dashboard
2. Navigate to Developers > Webhooks
3. Add endpoint: ${WEBHOOK_ENDPOINTS.stripe()}
4. Select events to listen for (payment_intent.succeeded, etc.)
5. Copy the signing secret to STRIPE_WEBHOOK_SECRET environment variable
      `.trim(),
    },
    ses: {
      url: WEBHOOK_ENDPOINTS.sesBounce(),
      instructions: `
1. Go to AWS SES Console
2. Navigate to Email Addresses or Domains
3. Set up SNS notifications for bounces and complaints
4. Create an SNS subscription with HTTPS endpoint: ${WEBHOOK_ENDPOINTS.sesBounce()}
      `.trim(),
    },
  };
}
