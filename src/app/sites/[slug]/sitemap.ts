import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getSubdomainUrl } from "@/lib/env-domains";
import { isFeatureEnabled } from "@/lib/feature-resolver";

/**
 * Generate a dynamic sitemap for each tenant site.
 *
 * This helps search engines discover all pages on the organization's site
 * and prioritize crawling based on page importance and update frequency.
 */
export default async function sitemap({
  params,
}: {
  params: { slug: string };
}): Promise<MetadataRoute.Sitemap> {
  const config = await db.websiteConfig.findUnique({
    where: { subdomain: params.slug },
    include: {
      organization: {
        include: {
          programs: {
            where: { status: "ACTIVE" },
            select: { id: true, updatedAt: true },
          },
        },
      },
    },
  });

  // Return empty sitemap if site doesn't exist or isn't published
  if (!config || !config.isPublished) {
    return [];
  }

  // Construct the base URL for the site
  const baseUrl = config.domain ? `https://${config.domain}` : getSubdomainUrl(config.subdomain!);

  const now = new Date();

  // Start with the homepage
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: config.updatedAt || now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];

  // Add calendar page if enabled
  if (config.showCalendar) {
    routes.push({
      url: `${baseUrl}/calendar`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  // Add registration page if enabled (high priority for conversions)
  if (config.showRegistration) {
    routes.push({
      url: `${baseUrl}/register`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    });
  }

  // Add competitions page if enabled
  if (config.showCompetitions) {
    routes.push({
      url: `${baseUrl}/competitions`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Add store page and individual product pages if enabled
  const storeFeatureEnabled = config.showStore
    ? await isFeatureEnabled(config.organizationId, "store")
    : false;
  if (config.showStore && storeFeatureEnabled) {
    const products = await db.product.findMany({
      where: { organizationId: config.organizationId, isActive: true },
      select: { id: true, updatedAt: true },
    });
    if (products.length > 0) {
      routes.push({
        url: `${baseUrl}/store`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
      for (const product of products) {
        routes.push({
          url: `${baseUrl}/store/${product.id}`,
          lastModified: product.updatedAt || now,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  }

  // Add contact page if enabled
  if (config.showContact) {
    routes.push({
      url: `${baseUrl}/contact`,
      lastModified: config.updatedAt || now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // Add facilities page if enabled
  if (config.showLocations) {
    routes.push({
      url: `${baseUrl}/facilities`,
      lastModified: config.updatedAt || now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // Add team page if enabled
  if (config.showTeam) {
    routes.push({
      url: `${baseUrl}/team`,
      lastModified: config.updatedAt || now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return routes;
}
