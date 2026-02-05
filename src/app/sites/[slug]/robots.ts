import { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { getSubdomainUrl } from '@/lib/env-domains';

/**
 * Generate a dynamic robots.txt for each tenant site.
 * 
 * - Non-production environments: Always block indexing
 * - Production + Published sites: Allow indexing
 * - Production + Unpublished sites: Block indexing
 */
export default async function robots({ 
  params 
}: { 
  params: { slug: string } 
}): Promise<MetadataRoute.Robots> {
  const appEnv = process.env.APP_ENVIRONMENT;
  const isProduction = appEnv === 'production';

  // Block all crawlers for non-production environments (staging, development, local)
  if (!isProduction) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  const config = await db.websiteConfig.findUnique({
    where: { subdomain: params.slug },
    select: { 
      isPublished: true, 
      domain: true, 
      subdomain: true 
    },
  });

  // Construct the base URL for the site
  const baseUrl = config?.domain 
    ? `https://${config.domain}` 
    : getSubdomainUrl(params.slug);

  // Only allow indexing for published sites in production
  if (config?.isPublished) {
    return {
      rules: [
        {
          userAgent: '*',
          allow: '/',
          // Block checkout and receipt pages (they contain personal info)
          disallow: ['/checkout', '/receipt'],
        },
      ],
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  }

  // Block all crawlers for unpublished sites
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
