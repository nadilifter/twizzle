import { MetadataRoute } from 'next';
import { db } from '@/lib/db';

/**
 * Generate a dynamic robots.txt for each tenant site.
 * 
 * Published sites are allowed to be indexed, while unpublished sites
 * are blocked from search engine crawlers.
 */
export default async function robots({ 
  params 
}: { 
  params: { slug: string } 
}): Promise<MetadataRoute.Robots> {
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
    : `https://${params.slug}.uplifterinc.com`;

  // Only allow indexing for published sites
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
