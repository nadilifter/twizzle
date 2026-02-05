/**
 * Centralized NextAuth.js Cookie Configuration
 * 
 * This module provides a single source of truth for all authentication cookies,
 * ensuring proper cross-subdomain sharing for OAuth flows.
 * 
 * Based on proven patterns from:
 * - Cal.com: https://github.com/calcom/cal.com/blob/main/packages/lib/default-cookies.ts
 * - Civitai: https://github.com/civitai/civitai/blob/main/src/server/auth/next-auth-options.ts
 * 
 * Key insight: OAuth flows require state, pkceCodeVerifier, and nonce cookies to be
 * shared across subdomains. Without proper domain configuration on these cookies,
 * OAuth callbacks will fail with "OAuthCallback" errors because the state verification
 * cannot find the cookies that were set before redirecting to the OAuth provider.
 */

import type { CookiesOptions } from "next-auth";
import { getCurrentEnvironment, getEnvConfig } from "./env-domains";

/**
 * Get the complete cookie configuration for NextAuth.js
 * 
 * This includes all cookies needed for:
 * - Session management (sessionToken)
 * - CSRF protection (csrfToken)
 * - OAuth flow state management (state, pkceCodeVerifier, nonce)
 * - Callback URL tracking (callbackUrl)
 * 
 * All cookies are configured with the appropriate domain for cross-subdomain
 * sharing in production/staging environments.
 */
export function getAuthCookies(): CookiesOptions {
  const env = getCurrentEnvironment();
  const config = getEnvConfig();
  
  // Use secure cookies for all non-local environments
  const useSecureCookies = env !== 'local';
  
  // Cookie name prefix: __Secure- for HTTPS, none for local dev
  const cookiePrefix = useSecureCookies ? "__Secure-" : "";
  
  // Cookie domain: shared domain for cloud envs, undefined for local
  // undefined means the cookie is set for the exact hostname only
  // Leading dot (e.g., .upliftergymnastics.com) enables subdomain sharing
  const cookieDomain = env === 'local' ? undefined : config.cookieDomain;
  
  // Default options shared by all cookies
  const defaultOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: useSecureCookies,
    domain: cookieDomain,
  };

  return {
    // Session token - the main authentication cookie
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: defaultOptions,
    },
    
    // Callback URL - tracks where to redirect after auth
    // Not httpOnly so client JS can read it if needed
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: { 
        ...defaultOptions, 
        httpOnly: false,
      },
    },
    
    // CSRF token - prevents cross-site request forgery
    csrfToken: {
      name: `${cookiePrefix}next-auth.csrf-token`,
      options: defaultOptions,
    },
    
    // PKCE code verifier - critical for OAuth security
    // Must be shared across subdomains for OAuth callback to work
    // maxAge: 15 minutes (900 seconds) - same as NextAuth default
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: { 
        ...defaultOptions, 
        maxAge: 900,
      },
    },
    
    // OAuth state - prevents CSRF in OAuth flows
    // Must be shared across subdomains for OAuth callback to work
    // maxAge: 15 minutes (900 seconds) - same as NextAuth default
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: { 
        ...defaultOptions, 
        maxAge: 900,
      },
    },
    
    // Nonce - used by some OAuth providers (OIDC)
    // Must be shared across subdomains for OAuth callback to work
    // maxAge: 15 minutes (900 seconds) - same as NextAuth default
    nonce: {
      name: `${cookiePrefix}next-auth.nonce`,
      options: { 
        ...defaultOptions, 
        maxAge: 900,
      },
    },
  };
}

/**
 * Get the session cookie name for the current environment
 * This is a convenience export for use in middleware and other places
 * that need to read the session cookie name directly.
 */
export function getSessionCookieName(): string {
  const env = getCurrentEnvironment();
  const useSecureCookies = env !== 'local';
  const cookiePrefix = useSecureCookies ? "__Secure-" : "";
  return `${cookiePrefix}next-auth.session-token`;
}
