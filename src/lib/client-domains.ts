/**
 * Client-side domain utilities
 * 
 * These functions work in the browser by detecting the environment from the
 * current URL. This is needed for client components that need to construct
 * URLs dynamically based on the environment the user is currently on.
 * 
 * For server-side code, use the functions in env-domains.ts instead.
 */

/**
 * Get the base domain from the current hostname
 * Detects the environment based on the URL the user is currently on
 */
export function getBaseDomainFromHostname(): { baseDomain: string; protocol: string } {
  if (typeof window === "undefined") {
    // Default to production for SSR
    return { baseDomain: "uplifterinc.com", protocol: "https" }
  }
  
  const hostname = window.location.hostname
  
  // Local development
  if (hostname.includes("localhost")) {
    // Extract the base domain pattern (e.g., "uplifterinc.localhost" from "startup.uplifterinc.localhost")
    const parts = hostname.split(".")
    if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
      const port = window.location.port ? `:${window.location.port}` : ""
      return { baseDomain: `${parts[parts.length - 2]}.localhost${port}`, protocol: "http" }
    }
    return { baseDomain: "uplifterinc.localhost:3000", protocol: "http" }
  }
  
  // Production/staging/dev domains - extract base domain from hostname
  // e.g., "startup.upliftergymnastics.com" -> "upliftergymnastics.com"
  // e.g., "admin.uplifterinc.com" -> "uplifterinc.com"
  const parts = hostname.split(".")
  if (parts.length >= 2) {
    const baseDomain = parts.slice(-2).join(".")
    return { baseDomain, protocol: "https" }
  }
  
  return { baseDomain: "uplifterinc.com", protocol: "https" }
}

/**
 * Get the full URL for a subdomain in the current environment (client-side)
 */
export function getClientSubdomainUrl(subdomain: string): string {
  const { baseDomain, protocol } = getBaseDomainFromHostname()
  return `${protocol}://${subdomain}.${baseDomain}`
}

/**
 * Get just the base domain suffix for display (e.g., ".upliftergymnastics.com")
 */
export function getBaseDomainSuffix(): string {
  const { baseDomain } = getBaseDomainFromHostname()
  // Remove port for display purposes
  const domainWithoutPort = baseDomain.split(':')[0]
  return `.${domainWithoutPort}`
}
