/**
 * Custom logout utility that properly clears session cookies across all subdomains.
 *
 * This is needed because NextAuth's default signOut doesn't correctly clear cookies
 * when using cross-subdomain sessions. The session cookie is set on a parent domain
 * (e.g., .uplifter.localhost or .uplifter.app), but NextAuth's signOut may
 * try to clear a cookie on the exact hostname only.
 *
 * Usage:
 * ```
 * import { logout } from "@/lib/logout";
 *
 * // In a client component:
 * const handleLogout = () => {
 *   logout("/login"); // Redirect to login page after logout
 * };
 * ```
 */

/**
 * Log out the current user and redirect to the login page.
 *
 * This function navigates to our custom logout endpoint which:
 * 1. Clears the session cookie with the correct domain
 * 2. Redirects to the login page
 *
 * Using a direct navigation (instead of fetch + client redirect) ensures
 * the Set-Cookie headers are properly processed by the browser as part
 * of the HTTP redirect response.
 *
 * @param _callbackUrl - Ignored for now; always redirects to login page
 */
export function logout(_callbackUrl: string = "/login"): void {
  // Navigate directly to the logout endpoint
  // This ensures the Set-Cookie headers are processed as part of the redirect
  window.location.href = "/api/auth/logout";
}

/**
 * Get the URL for a GET-based logout (useful for links)
 * This returns the logout endpoint URL that can be used in an anchor tag.
 */
export function getLogoutUrl(): string {
  return "/api/auth/logout";
}
