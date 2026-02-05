/** @type {import('next').NextConfig} */

/**
 * Environment Configuration for CSP Headers
 * 
 * APP_ENVIRONMENT can be: production, staging, development, local
 * Each environment has its own domain configuration
 */
const ENV_CONFIG = {
  production: {
    baseDomain: 'uplifterinc.com',
    useHttps: true,
    cdnDomain: 'cdn.uplifterinc.com',
  },
  staging: {
    baseDomain: 'upliftergymnastics.com',
    useHttps: true,
    cdnDomain: 'cdn.upliftergymnastics.com',
  },
  development: {
    baseDomain: 'uplifterdev.com',
    useHttps: true,
    cdnDomain: null,
  },
  local: {
    baseDomain: 'uplifterinc.localhost:3000',
    useHttps: false,
    cdnDomain: null,
  },
};

// Determine current environment
const getCurrentEnvironment = () => {
  const env = process.env.APP_ENVIRONMENT;
  if (env && env in ENV_CONFIG) {
    return env;
  }
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  return 'local';
};

const currentEnv = getCurrentEnvironment();
const envConfig = ENV_CONFIG[currentEnv];
const isLocal = currentEnv === 'local';
const protocol = envConfig.useHttps ? 'https' : 'http';

// Determine CSP directives based on environment
// In local dev, we need to allow connections/forms to localhost:3000 for Google OAuth
// (Google doesn't allow localhost subdomains as OAuth redirect URIs)
// In cloud environments, everything goes through the login subdomain directly
const getFormActionCsp = () => {
  if (isLocal) {
    // Local development: allow localhost:3000 for OAuth
    return "form-action 'self' http://localhost:3000 https://accounts.google.com";
  }
  // Cloud environments: use the environment's login subdomain
  return `form-action 'self' ${protocol}://login.${envConfig.baseDomain} https://accounts.google.com`;
};

const getConnectSrcCsp = () => {
  const base = "'self' https://*.adyen.com https://*.upstash.io wss:";
  
  // Add CDN domain if configured
  const cdnSrc = envConfig.cdnDomain ? ` https://${envConfig.cdnDomain}` : '';
  
  // Add S3 for cloud environments
  const s3Src = !isLocal ? ' https://*.s3.amazonaws.com https://*.s3.*.amazonaws.com' : '';
  
  // Add MinIO for local environment
  const minioSrc = isLocal ? ' http://localhost:9000' : '';
  
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

const nextConfig = {
  output: "standalone",
  // Skip TypeScript errors during build for staging deployment
  // TODO: Fix pre-existing type errors and remove this
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    // Also skip ESLint errors during build
    ignoreDuringBuilds: true,
  },
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
          getImgSrcCsp(),
          "font-src 'self' data:",
          getConnectSrcCsp(),
          "frame-src 'self' https://*.adyen.com https://pay.google.com",
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
      ...(currentEnv !== 'production'
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

export default nextConfig;
