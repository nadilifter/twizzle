import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

/**
 * Environment Configuration for CSP Headers
 *
 * APP_ENVIRONMENT can be: production, staging, development, local
 * Each environment has its own domain configuration
 */
const ENV_CONFIG = {
  production: {
    baseDomain: "uplifter.app",
    useHttps: true,
    cdnDomain: "cdn.uplifter.app",
    s3Bucket: "uplifter-assets-prod",
  },
  staging: {
    baseDomain: "upliftergymnastics.com",
    useHttps: true,
    cdnDomain: "assets.upliftergymnastics.com",
    s3Bucket: "uplifter-gymnastics-assets",
  },
  development: {
    baseDomain: "uplifterdev.com",
    useHttps: true,
    cdnDomain: null,
    s3Bucket: "uplifter-assets-dev",
  },
  local: {
    baseDomain: "uplifter.localhost:3000",
    useHttps: false,
    cdnDomain: null,
    s3Bucket: "local-assets",
  },
};

// Determine current environment
const getCurrentEnvironment = () => {
  const env = process.env.APP_ENVIRONMENT;
  if (env && env in ENV_CONFIG) {
    return env;
  }
  if (process.env.NODE_ENV === "production") {
    return "production";
  }
  return "local";
};

const currentEnv = getCurrentEnvironment();
const envConfig = ENV_CONFIG[currentEnv];
const isLocal = currentEnv === "local";
const protocol = envConfig.useHttps ? "https" : "http";

// Determine CSP directives based on environment
// In local dev, we need to allow connections/forms to localhost:3000 for OAuth
// (OAuth providers don't allow localhost subdomains as redirect URIs)
// In cloud environments, everything goes through the login subdomain directly
const getFormActionCsp = () => {
  if (isLocal) {
    return "form-action 'self' http://localhost:3000 https://accounts.google.com https://login.microsoftonline.com";
  }
  return `form-action 'self' ${protocol}://login.${envConfig.baseDomain} https://accounts.google.com https://login.microsoftonline.com`;
};

const getConnectSrcCsp = () => {
  const base =
    "'self' https://*.adyen.com https://*.upstash.io wss: https://google.com https://pay.google.com https://*.zendesk.com https://*.zopim.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io";

  // Add CDN domain if configured
  const cdnSrc = envConfig.cdnDomain ? ` https://${envConfig.cdnDomain}` : "";

  // Add S3 for cloud environments
  // Only *.s3.amazonaws.com (global endpoint) is valid CSP; *.s3.*.amazonaws.com has a
  // wildcard in a non-leftmost label which violates the CSP spec. Use *.amazonaws.com
  // to also cover regional endpoints like bucket.s3.us-east-1.amazonaws.com.
  const s3Src = !isLocal ? " https://*.s3.amazonaws.com https://*.amazonaws.com" : "";

  // Add MinIO for local environment
  const minioSrc = isLocal ? " http://localhost:9000" : "";

  if (isLocal) {
    // Local: allow fetching CSRF token from localhost:3000 and MinIO
    return `connect-src ${base}${cdnSrc}${minioSrc} http://localhost:3000`;
  }

  return `connect-src ${base}${cdnSrc}${s3Src}`;
};

const getImgSrcCsp = () => {
  const base = "'self' data: blob: https:";

  // Add MinIO for local environment
  if (isLocal) {
    return `img-src ${base} http://localhost:9000`;
  }

  return `img-src ${base}`;
};

// Build remote patterns for Next.js Image component
const getImageRemotePatterns = () => {
  const patterns = [];

  // Add patterns for all environments to support development/preview
  Object.values(ENV_CONFIG).forEach((config) => {
    // CDN domain
    if (config.cdnDomain) {
      patterns.push({
        protocol: "https",
        hostname: config.cdnDomain,
        pathname: "/**",
      });
    }

    // S3 bucket (direct access pattern)
    if (config.s3Bucket) {
      patterns.push({
        protocol: "https",
        hostname: `${config.s3Bucket}.s3.*.amazonaws.com`,
        pathname: "/**",
      });
      patterns.push({
        protocol: "https",
        hostname: `${config.s3Bucket}.s3.amazonaws.com`,
        pathname: "/**",
      });
    }
  });

  // Local MinIO for development
  patterns.push({
    protocol: "http",
    hostname: "localhost",
    port: "9000",
    pathname: "/**",
  });

  return patterns;
};

// Extract just the hostname for allowedDevOrigins (strip port if present)
const localHostname = isLocal ? envConfig.baseDomain.split(":")[0] : null;

const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  allowedDevOrigins: isLocal ? [`*.${localHostname}`] : [],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Configure allowed remote image sources for Next.js Image component
  images: {
    remotePatterns: getImageRemotePatterns(),
  },
  // Improve local development performance
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },
  experimental: {
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
      "recharts",
    ],
  },
  async redirects() {
    return [
      {
        source: "/dashboard/organization/website/team",
        destination: "/dashboard/website/team",
        permanent: true,
      },
      {
        source: "/dashboard/organization/website",
        destination: "/dashboard/website",
        permanent: true,
      },
      {
        source: "/dashboard/competitions/marketing",
        destination: "/dashboard/website/competitions",
        permanent: true,
      },
    ];
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
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pay.google.com https://*.adyen.com https://static.zdassets.com https://*.zendesk.com https://*.zopim.com",
          "style-src 'self' 'unsafe-inline'",
          getImgSrcCsp(),
          "font-src 'self' data:",
          getConnectSrcCsp(),
          "frame-src 'self' https://*.adyen.com https://pay.google.com https://*.zendesk.com",
          "frame-ancestors 'none'",
          getFormActionCsp(),
          "base-uri 'self'",
          "object-src 'none'",
        ].join("; "),
      },
      // Strict Transport Security (HSTS) - only in cloud environments with HTTPS
      ...(!isLocal
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ]
        : []),
      // Prevent search engine indexing for non-production environments
      // Staging, development, and local should never be indexed
      ...(currentEnv !== "production"
        ? [
            {
              key: "X-Robots-Tag",
              value: "noindex, nofollow, noarchive, nosnippet",
            },
          ]
        : []),
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

export default withSentryConfig(nextConfig, {
  org: "uplifter-us-llc",
  project: "uplifter-nextjs",
  silent: !process.env.CI,
  disableLogger: true,
  telemetry: false,
  widenClientFileUpload: true,
});
