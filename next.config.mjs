/** @type {import('next').NextConfig} */

// Determine CSP directives based on environment
// In development, we need to allow connections/forms to localhost:3000 for Google OAuth
// (Google doesn't allow localhost subdomains as OAuth redirect URIs)
// In production, everything goes through the login subdomain directly
const getFormActionCsp = () => {
  if (process.env.NODE_ENV === "production") {
    return "form-action 'self' https://login.uplifterinc.com https://accounts.google.com";
  }
  // Development: allow localhost:3000 for OAuth
  return "form-action 'self' http://localhost:3000 https://accounts.google.com";
};

const getConnectSrcCsp = () => {
  const base = "'self' https://*.adyen.com https://*.upstash.io wss:";
  if (process.env.NODE_ENV === "production") {
    return `connect-src ${base}`;
  }
  // Development: allow fetching CSRF token from localhost:3000
  return `connect-src ${base} http://localhost:3000`;
};

const nextConfig = {
  output: "standalone",
  // Improve local development performance
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  experimental: {
    // Optimize memory usage during development
    optimizePackageImports: [
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      "lucide-react",
      "date-fns",
      "recharts"
    ],
  },
  async headers() {
    // Security headers for all routes
    const securityHeaders = [
      // Prevent clickjacking attacks
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      // Prevent MIME type sniffing
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      // Control referrer information
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      // XSS Protection (legacy but still useful for older browsers)
      {
        key: "X-XSS-Protection",
        value: "1; mode=block",
      },
      // Restrict browser features/APIs
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
      },
      // Content Security Policy - relatively permissive for app functionality
      // Tighten these values based on your specific needs
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pay.google.com https://*.adyen.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          getConnectSrcCsp(),
          "frame-src 'self' https://*.adyen.com https://pay.google.com",
          "frame-ancestors 'none'",
          getFormActionCsp(),
          "base-uri 'self'",
          "object-src 'none'",
        ].join("; "),
      },
      // Strict Transport Security (HSTS) - only in production
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ]
        : []),
      // Prevent search engine indexing during pilot
      {
        key: "X-Robots-Tag",
        value: "noindex, nofollow, noarchive, nosnippet",
      },
    ];

    // Note: CORS is handled dynamically in middleware.ts for proper origin validation
    // with credentials support across subdomains

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
