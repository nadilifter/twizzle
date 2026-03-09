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
  
  // Cookie domain for cloud envs (production/staging)
  const cloudDomain = env === 'local' ? undefined : config.cookieDomain;

  // Session cookie domain: ALWAYS use the shared parent domain so the cookie
  // is visible across all subdomains (login, admin, athletes, etc.).
  //
  // In local dev this is ".uplifterinc.localhost". Credentials login happens
  // on login.uplifterinc.localhost which is a subdomain of uplifterinc.localhost,
  // so the browser accepts the domain attribute. For OAuth through localhost:3000,
  // the browser rejects this domain (different TLD), but that's fine — session-bridge
  // sets the real cookie from the correct domain afterward.
  const sessionDomain = env === 'local' ? '.uplifterinc.localhost' : cloudDomain;

  // Other cookies (CSRF, callback-url, state, PKCE, nonce) stay hostname-scoped
  // in local dev. OAuth flows go through localhost:3000, which can't set cookies
  // on .uplifterinc.localhost. These cookies are only needed during the auth
  // handshake on the same hostname, so hostname-scoping is correct.
  const defaultOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: useSecureCookies,
    domain: cloudDomain,
  };

  return {
    // Session token — uses the shared domain so it's visible across all subdomains
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: { ...defaultOptions, domain: sessionDomain },
    },
    
    // Callback URL - tracks where to redirect after auth
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
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: { 
        ...defaultOptions, 
        maxAge: 900,
      },
    },
    
    // OAuth state - prevents CSRF in OAuth flows
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: { 
        ...defaultOptions, 
        maxAge: 900,
      },
    },
    
    // Nonce - used by some OAuth providers (OIDC)
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
