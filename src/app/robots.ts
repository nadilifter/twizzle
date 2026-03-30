import { MetadataRoute } from "next";

/**
 * Dynamic robots.txt configuration based on environment.
 *
 * - Production: Allow indexing (when ready for public launch)
 * - Staging/Development/Local: Block all crawlers
 *
 * This file takes precedence over public/robots.txt
 */
export default function robots(): MetadataRoute.Robots {
  const appEnv = process.env.APP_ENVIRONMENT;
  const isProduction = appEnv === "production";

  // Block all crawlers for non-production environments
  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  // Production: Allow indexing but block sensitive paths
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/superadmin/",
          "/coach/",
          "/pos/",
          "/checkout/",
          "/receipt/",
          "/_next/",
        ],
      },
    ],
    sitemap: "https://uplifterinc.com/sitemap.xml",
  };
}
