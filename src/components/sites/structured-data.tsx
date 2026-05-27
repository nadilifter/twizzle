/**
 * Structured Data (JSON-LD) Components for SEO
 *
 * These components generate schema.org structured data to help search engines
 * better understand figure skating organization websites.
 */

function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

interface OrganizationSchemaProps {
  organization: {
    name: string;
    email?: string | null;
    phone?: string | null;
    street?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
    logo?: string | null;
  };
  siteUrl: string;
  heroImage?: string | null;
}

/**
 * SportsOrganization Schema
 *
 * Signals to Google that this is a sports-related organization.
 * Helps with discovery in sports-related searches.
 */
export function OrganizationStructuredData({
  organization,
  siteUrl,
  heroImage,
}: OrganizationSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: organization.name,
    url: siteUrl,
    ...(organization.logo && { logo: organization.logo }),
    ...(heroImage && { image: heroImage }),
    ...(organization.email && { email: `mailto:${organization.email}` }),
    ...(organization.phone && { telephone: organization.phone }),
    ...(organization.street && {
      address: {
        "@type": "PostalAddress",
        streetAddress: organization.street,
        addressLocality: organization.city,
        addressRegion: organization.stateProvince,
        postalCode: organization.postalCode,
        addressCountry: organization.country || "US",
      },
    }),
    // Sports-specific properties
    sport: "Figure Skating",
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
  );
}

/**
 * SportsActivityLocation Schema
 *
 * Signals to Google that this is a local business offering sports activities.
 * Helps with Google Maps and Local Pack visibility.
 */
export function LocalBusinessStructuredData({
  organization,
  siteUrl,
  heroImage,
}: OrganizationSchemaProps) {
  const locationDescription =
    organization.city && organization.stateProvince
      ? `Figure skating programs and classes in ${organization.city}, ${organization.stateProvince}`
      : `Figure skating programs and classes for all ages and skill levels`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: organization.name,
    url: siteUrl,
    description: locationDescription,
    ...(organization.logo && { logo: organization.logo }),
    ...(heroImage && { image: heroImage }),
    ...(organization.email && { email: `mailto:${organization.email}` }),
    ...(organization.phone && { telephone: organization.phone }),
    ...(organization.street && {
      address: {
        "@type": "PostalAddress",
        streetAddress: organization.street,
        addressLocality: organization.city,
        addressRegion: organization.stateProvince,
        postalCode: organization.postalCode,
        addressCountry: organization.country || "US",
      },
    }),
    // Business-specific properties
    priceRange: "$$",
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
  );
}

/**
 * WebSite Schema
 *
 * Helps Google understand this is a website with a searchable structure.
 */
export function WebSiteStructuredData({
  organization,
  siteUrl,
}: Pick<OrganizationSchemaProps, "organization" | "siteUrl">) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: organization.name,
    url: siteUrl,
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
  );
}

/**
 * Combined Structured Data Component
 *
 * Renders all relevant structured data schemas for a figure skating organization site.
 */
export function SiteStructuredData(props: OrganizationSchemaProps) {
  return (
    <>
      <OrganizationStructuredData {...props} />
      <LocalBusinessStructuredData {...props} />
      <WebSiteStructuredData organization={props.organization} siteUrl={props.siteUrl} />
    </>
  );
}
