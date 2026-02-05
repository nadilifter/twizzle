/**
 * Environment-based domain and service configuration
 * 
 * This module provides centralized configuration for all environment-specific
 * settings including domains, S3 buckets, CDN URLs, and service endpoints.
 */

export type Environment = 'production' | 'staging' | 'development' | 'local';

export interface EnvironmentConfig {
  /** Base domain without protocol (e.g., 'uplifterinc.com') */
  baseDomain: string;
  /** Cookie domain for session sharing across subdomains */
  cookieDomain: string;
  /** S3 bucket name for assets */
  s3Bucket: string;
  /** S3 bucket name for documents (private files) */
  s3DocumentsBucket: string;
  /** CDN URL for public assets (null if no CDN) */
  cdnUrl: string | null;
  /** Whether this environment uses HTTPS */
  useHttps: boolean;
  /** List of allowed CORS origins */
  corsOrigins: string[];
}

export const ENV_CONFIG: Record<Environment, EnvironmentConfig> = {
  production: {
    baseDomain: 'uplifterinc.com',
    cookieDomain: '.uplifterinc.com',
    s3Bucket: 'uplifter-assets-prod',
    s3DocumentsBucket: 'uplifter-documents-prod',
    cdnUrl: 'https://cdn.uplifterinc.com',
    useHttps: true,
    corsOrigins: [
      'https://uplifterinc.com',
      'https://*.uplifterinc.com',
    ],
  },
  staging: {
    baseDomain: 'upliftergymnastics.com',
    cookieDomain: '.upliftergymnastics.com',
    s3Bucket: 'uplifter-gymnastics-assets',
    s3DocumentsBucket: 'uplifter-gymnastics-docs',
    cdnUrl: 'https://assets.upliftergymnastics.com',
    useHttps: true,
    corsOrigins: [
      'https://upliftergymnastics.com',
      'https://*.upliftergymnastics.com',
    ],
  },
  development: {
    baseDomain: 'uplifterdev.com',
    cookieDomain: '.uplifterdev.com',
    s3Bucket: 'uplifter-assets-dev',
    s3DocumentsBucket: 'uplifter-documents-dev',
    cdnUrl: null,
    useHttps: true,
    corsOrigins: [
      'https://uplifterdev.com',
      'https://*.uplifterdev.com',
    ],
  },
  local: {
    baseDomain: 'uplifterinc.localhost:3000',
    cookieDomain: 'localhost',
    s3Bucket: 'local-assets',
    s3DocumentsBucket: 'local-documents',
    cdnUrl: null,
    useHttps: false,
    corsOrigins: [
      'http://localhost:3000',
      'http://*.localhost:3000',
      'http://uplifterinc.localhost:3000',
      'http://*.uplifterinc.localhost:3000',
    ],
  },
};

/**
 * Get the current environment from APP_ENVIRONMENT env var
 * Defaults to 'local' if not set
 */
export function getCurrentEnvironment(): Environment {
  const env = process.env.APP_ENVIRONMENT;
  if (env && env in ENV_CONFIG) {
    return env as Environment;
  }
  // Fallback detection based on NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  return 'local';
}

/**
 * Get the configuration for the current environment
 */
export function getEnvConfig(): EnvironmentConfig {
  return ENV_CONFIG[getCurrentEnvironment()];
}

/**
 * Get the full URL for a subdomain in the current environment
 */
export function getSubdomainUrl(subdomain: string): string {
  const config = getEnvConfig();
  const protocol = config.useHttps ? 'https' : 'http';
  return `${protocol}://${subdomain}.${config.baseDomain}`;
}

/**
 * Get the base URL for the current environment (no subdomain)
 */
export function getBaseUrl(): string {
  const config = getEnvConfig();
  const protocol = config.useHttps ? 'https' : 'http';
  return `${protocol}://${config.baseDomain}`;
}

/**
 * Production marketing site URLs (docs, contact).
 * Use these for help/documentation/contact links so they always point to the real
 * marketing site, not a nonexistent staging/dev marketing site.
 */
export const MARKETING_DOCS_URL = 'https://learn.uplifterinc.com/';
export const MARKETING_CONTACT_URL = 'https://www.uplifterinc.com/contact-us';

/**
 * Get the login portal URL
 */
export function getLoginUrl(callbackUrl?: string): string {
  const loginUrl = getSubdomainUrl('login');
  if (callbackUrl) {
    return `${loginUrl}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }
  return loginUrl;
}

/**
 * Build login URL from the request Host header so the Sign in link stays in the
 * same environment (e.g. on startup.upliftergymnastics.com -> login.upliftergymnastics.com).
 * Use this in server components that render the startup/org-signup pages.
 */
export function getLoginUrlForHost(hostHeader: string | null): string {
  if (!hostHeader) {
    return getLoginUrl();
  }
  const [hostname, port] = hostHeader.split(':');
  const parts = hostname.split('.');
  const useHttps = !hostname.includes('localhost');
  const protocol = useHttps ? 'https' : 'http';
  let baseDomain: string;
  if (hostname.includes('localhost')) {
    baseDomain = parts.length >= 2 ? parts.slice(-2).join('.') : 'uplifterinc.localhost';
    if (port) baseDomain += `:${port}`;
  } else {
    baseDomain = parts.length >= 2 ? parts.slice(-2).join('.') : 'uplifterinc.com';
  }
  return `${protocol}://login.${baseDomain}`;
}

/**
 * Get the session cookie name based on the environment.
 * Uses __Secure- prefix for secure environments (production/staging).
 */
export function getSessionCookieName(): string {
  const currentEnv = getCurrentEnvironment();
  const isLocal = currentEnv === 'local';
  return isLocal ? "next-auth.session-token" : "__Secure-next-auth.session-token";
}

/**
 * Check if a hostname belongs to the current environment's domain
 */
export function isValidDomain(hostname: string): boolean {
  const config = getEnvConfig();
  const baseDomain = config.baseDomain.split(':')[0]; // Remove port if present
  return hostname === baseDomain || 
         hostname.endsWith(`.${baseDomain}`) ||
         hostname === `www.${baseDomain}`;
}

/**
 * Extract subdomain from a full hostname
 * Returns null if no subdomain or invalid domain
 */
export function extractSubdomain(hostname: string): string | null {
  const config = getEnvConfig();
  const baseDomain = config.baseDomain.split(':')[0]; // Remove port if present
  
  if (hostname === baseDomain || hostname === `www.${baseDomain}`) {
    return null;
  }
  
  if (hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.slice(0, -(baseDomain.length + 1));
    return subdomain || null;
  }
  
  return null;
}

/**
 * Check if an origin is allowed for CORS/Auth
 * Based on the current environment configuration
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  const config = getEnvConfig();
  const currentEnv = getCurrentEnvironment();
  const baseDomain = config.baseDomain.split(':')[0]; // Remove port if present
  
  // Local environment allows localhost variations
  if (currentEnv === 'local') {
    if (origin.includes("localhost")) return true;
    if (origin.includes("uplifterinc.localhost")) return true;
  }
  
  // Check against the current environment's domain
  const protocol = config.useHttps ? 'https' : 'http';
  if (origin === `${protocol}://${baseDomain}` || 
      origin === `${protocol}://www.${baseDomain}`) {
    return true;
  }
  
  // Check subdomains
  if (origin.endsWith(`.${baseDomain}`)) {
    return true;
  }
  
  // Check explicitly configured CORS origins
  if (config.corsOrigins.includes(origin)) {
    return true;
  }
  
  // Wildcard check for corsOrigins
  for (const allowed of config.corsOrigins) {
    if (allowed.includes('*')) {
      const regex = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      if (regex.test(origin)) return true;
    }
  }
  
  return false;
}

/**
 * Get the public URL for an asset (uses CDN if available)
 */
export function getAssetUrl(path: string): string {
  const config = getEnvConfig();
  if (config.cdnUrl) {
    return `${config.cdnUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
  // Fallback to direct S3 URL
  const region = process.env.AWS_S3_REGION || 'us-east-1';
  return `https://${config.s3Bucket}.s3.${region}.amazonaws.com${path.startsWith('/') ? path : `/${path}`}`;
}
