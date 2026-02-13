/**
 * External Services Configuration
 * 
 * This module provides environment-aware configuration for all external services
 * including Adyen, Twilio, SES, and future integrations like Stripe.
 */

import { getEnvConfig, getCurrentEnvironment, type Environment } from './env-domains';

/**
 * Service mode type - TEST for sandbox/development, LIVE for production
 */
export type ServiceMode = 'TEST' | 'LIVE';

/**
 * Adyen configuration interface
 */
export interface AdyenConfig {
  apiKey: string;
  merchantAccount: string;
  environment: ServiceMode;
  clientKey: string;
  webhookHmacKey?: string;
  apiEndpoint: string;
}

/**
 * Twilio configuration interface
 */
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  phoneNumber?: string;
  environment: ServiceMode;
  webhookUrl: string;
}

/**
 * SES configuration interface
 */
export interface SESConfig {
  region: string;
  fromEmail: string;
  endpoint?: string;  // For MailHog in local dev
  mode: 'sandbox' | 'production';
  /** SES Configuration Set name for event tracking (bounces, complaints, deliveries) */
  configurationSetName?: string;
}

/**
 * Get the service mode based on environment
 * Only production uses LIVE mode, all others use TEST
 */
export function getServiceMode(): ServiceMode {
  const currentEnv = getCurrentEnvironment();
  return currentEnv === 'production' ? 'LIVE' : 'TEST';
}

/**
 * Get Adyen configuration for the current environment
 */
export function getAdyenConfig(): AdyenConfig {
  const mode = process.env.ADYEN_ENVIRONMENT as ServiceMode || getServiceMode();
  
  return {
    apiKey: process.env.ADYEN_API_KEY || '',
    merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT || '',
    environment: mode,
    clientKey: process.env.NEXT_PUBLIC_ADYEN_CLIENT_KEY || '',
    webhookHmacKey: process.env.ADYEN_WEBHOOK_HMAC_KEY,
    apiEndpoint: mode === 'LIVE' 
      ? 'https://checkout-live.adyen.com' 
      : 'https://checkout-test.adyen.com',
  };
}

/**
 * Get Twilio configuration for the current environment
 */
export function getTwilioConfig(): TwilioConfig {
  const config = getEnvConfig();
  const mode = process.env.TWILIO_ENVIRONMENT as ServiceMode || getServiceMode();
  const currentEnv = getCurrentEnvironment();
  
  // Determine webhook URL
  let webhookUrl = process.env.TWILIO_WEBHOOK_URL;
  if (!webhookUrl) {
    if (currentEnv === 'local') {
      // Use ngrok tunnel URL for local development if configured
      webhookUrl = process.env.WEBHOOK_TUNNEL_URL || 'http://localhost:3000';
    } else {
      // Use admin subdomain for cloud environments
      const protocol = config.useHttps ? 'https' : 'http';
      webhookUrl = `${protocol}://admin.${config.baseDomain}`;
    }
  }
  
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    environment: mode,
    webhookUrl: `${webhookUrl}/api/twilio/webhook`,
  };
}

/**
 * Get SES configuration for the current environment
 */
export function getSESConfig(): SESConfig {
  const config = getEnvConfig();
  const currentEnv = getCurrentEnvironment();
  
  // Determine from email based on environment
  let fromEmail = process.env.AWS_SES_FROM_EMAIL;
  if (!fromEmail) {
    fromEmail = `noreply@${config.baseDomain.split(':')[0]}`;
  }
  
  return {
    region: process.env.AWS_SES_REGION || 'us-east-1',
    fromEmail,
    endpoint: currentEnv === 'local' ? (process.env.SES_ENDPOINT || 'http://localhost:1025') : undefined,
    mode: currentEnv === 'production' ? 'production' : 'sandbox',
    configurationSetName: process.env.AWS_SES_CONFIGURATION_SET || undefined,
  };
}

/**
 * Get webhook base URL for the current environment
 */
export function getWebhookBaseUrl(): string {
  const config = getEnvConfig();
  const currentEnv = getCurrentEnvironment();
  
  if (currentEnv === 'local') {
    // Use ngrok tunnel URL for local development if configured
    return process.env.WEBHOOK_TUNNEL_URL || 'http://localhost:3000';
  }
  
  const protocol = config.useHttps ? 'https' : 'http';
  return `${protocol}://admin.${config.baseDomain}`;
}

/**
 * Get all webhook endpoints for the current environment
 */
export const WEBHOOK_ENDPOINTS = {
  adyen: () => `${getWebhookBaseUrl()}/api/webhooks/adyen`,
  twilio: () => `${getWebhookBaseUrl()}/api/twilio/webhook`,
  stripe: () => `${getWebhookBaseUrl()}/api/webhooks/stripe`,
  sesBounce: () => `${getWebhookBaseUrl()}/api/webhooks/ses-bounce`,
} as const;

/**
 * Check if a service is properly configured
 */
export function isServiceConfigured(service: 'adyen' | 'twilio' | 'ses' | 'stripe'): boolean {
  switch (service) {
    case 'adyen':
      return !!(process.env.ADYEN_API_KEY && process.env.ADYEN_MERCHANT_ACCOUNT);
    case 'twilio':
      return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    case 'ses':
      return !!(process.env.AWS_SES_REGION);
    case 'stripe':
      return !!(process.env.STRIPE_SECRET_KEY);
    default:
      return false;
  }
}

/**
 * Get service status for health checks
 */
export function getServiceStatus(): Record<string, { configured: boolean; mode: string }> {
  const mode = getServiceMode();
  
  return {
    adyen: {
      configured: isServiceConfigured('adyen'),
      mode: process.env.ADYEN_ENVIRONMENT || mode,
    },
    twilio: {
      configured: isServiceConfigured('twilio'),
      mode: process.env.TWILIO_ENVIRONMENT || mode,
    },
    ses: {
      configured: isServiceConfigured('ses'),
      mode: getCurrentEnvironment() === 'production' ? 'production' : 'sandbox',
    },
    stripe: {
      configured: isServiceConfigured('stripe'),
      mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'LIVE' : 'TEST',
    },
  };
}
