import React from "react";
import { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { MarketingAnnouncementBell } from "@/components/marketing-announcement-bell";
import { CartProvider } from "@/components/sites/cart-context";
import { CartSheet } from "@/components/sites/cart-sheet";
import { CartFloatingButton } from "@/components/sites/cart-floating-button";
import { QueueProvider } from "@/components/sites/queue-context";
import { VisitorTracker } from "@/components/sites/visitor-tracker";
import { CookieNotice } from "@/components/sites/cookie-notice";
import { SiteStructuredData } from "@/components/sites/structured-data";
import { getSubdomainUrl, getLoginUrl as getEnvLoginUrl } from "@/lib/env-domains";
import { getAuthSession } from "@/lib/auth";
import { MarketingUserMenu } from "@/components/sites/marketing-user-menu";

export const dynamic = "force-dynamic";

/**
 * Get the login URL for tenant sites.
 * Redirects to the centralized login portal with callback to return to the tenant site.
 */
function getLoginUrl(subdomain: string): string {
  // Construct the callback URL to return to this tenant site after login
  const callbackUrl = `${getSubdomainUrl(subdomain)}/`;
  
  // Construct the login URL with callback
  return getEnvLoginUrl(callbackUrl);
}

// Helper to convert hex to HSL
function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  // Return HSL without the hsl() wrapper for Tailwind CSS variables
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Generate SEO-optimized metadata for tenant sites.
 * Includes Open Graph, Twitter Cards, canonical URLs, and keywords.
 * 
 * Note: Non-production environments (staging, development, local) are always blocked
 * from indexing regardless of the site's published status.
 */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const config = await db.websiteConfig.findUnique({
    where: { subdomain: params.slug },
    include: { organization: true },
  });
  if (!config) return {};

  const org = config.organization;
  
  // Check if we're in production - only production sites can be indexed
  const isProduction = process.env.APP_ENVIRONMENT === 'production';
  
  // Construct the canonical site URL
  const siteUrl = config.domain 
    ? `https://${config.domain}` 
    : getSubdomainUrl(config.subdomain!);

  // Generate description: use custom SEO description, or hero content, or default
  const locationText = org.city && org.stateProvince 
    ? `in ${org.city}, ${org.stateProvince}` 
    : "";
  const defaultDescription = `${org.name} - Gymnastics programs ${locationText}. Classes for all ages and skill levels.`.trim().replace(/\s+/g, ' ');
  const description = config.seoDescription || config.heroSubheadline || defaultDescription;

  // Build keywords array: use custom keywords or generate defaults for gymnastics
  const customKeywords = config.seoKeywords 
    ? config.seoKeywords.split(',').map(k => k.trim()).filter(Boolean)
    : [];
  
  const defaultKeywords = [
    'gymnastics',
    'gymnastics classes',
    'gymnastics programs',
    'youth gymnastics',
    'kids gymnastics',
    org.city,
    org.stateProvince,
    `gymnastics ${org.city}`,
    'tumbling',
    'recreational gymnastics',
    'competitive gymnastics',
  ].filter(Boolean) as string[];

  // Merge custom keywords with defaults, removing duplicates
  const keywords = customKeywords.length > 0 
    ? Array.from(new Set([...customKeywords, ...defaultKeywords]))
    : defaultKeywords;

  // Determine robots directive:
  // - Non-production: always noindex
  // - Production + published: index
  // - Production + unpublished: noindex
  const shouldIndex = isProduction && config.isPublished;

  return {
    title: {
      default: org.name,
      template: `%s | ${org.name}`,
    },
    description,
    keywords,
    icons: { 
      icon: config.favicon || "/favicon.ico",
    },
    metadataBase: new URL(siteUrl),
    alternates: { 
      canonical: siteUrl,
    },
    openGraph: {
      type: 'website',
      siteName: org.name,
      title: org.name,
      description,
      url: siteUrl,
      locale: 'en_US',
      images: config.heroImage 
        ? [{ 
            url: config.heroImage, 
            alt: `${org.name} - Gymnastics`,
            width: 1200,
            height: 630,
          }] 
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: org.name,
      description,
      images: config.heroImage ? [config.heroImage] : [],
    },
    // Block indexing for non-production environments or unpublished sites
    robots: shouldIndex 
      ? { index: true, follow: true }
      : { index: false, follow: false },
    // Google Search Console verification (only relevant for production)
    ...(isProduction && config.googleVerification && {
      verification: {
        google: config.googleVerification,
      },
    }),
  };
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const subdomain = params?.slug;

  if (!subdomain) return notFound();

  const config = await db.websiteConfig.findUnique({
    where: { subdomain: subdomain },
    include: { organization: true },
  });

  if (!config || !config.isPublished) {
    return notFound();
  }

  // Get login URL for this tenant site
  const loginUrl = getLoginUrl(subdomain);

  // Check if user has an active session (cookie is shared across subdomains)
  const session = await getAuthSession();

  // Determine if the logged-in user is an admin on any organization
  let isAdmin = false;
  if (session?.user) {
    if (session.user.isSuperAdmin) {
      isAdmin = true;
    } else {
      const adminMembership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      isAdmin = !!adminMembership;
    }
  }

  // Build portal URLs for the user menu
  const adminUrl = getSubdomainUrl("admin");
  const athleteUrl = getSubdomainUrl("athletes");

  const primaryColor = config.primaryColor || "#000000";
  const secondaryColor = config.secondaryColor || "#ffffff";
  
  // Convert to HSL for Tailwind CSS variables
  const primaryHSL = hexToHSL(primaryColor);

  // Construct the canonical site URL for structured data
  const siteUrl = config.domain 
    ? `https://${config.domain}` 
    : getSubdomainUrl(config.subdomain!);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
    <QueueProvider organizationSlug={subdomain}>
    <CartProvider>
    <div className="min-h-screen flex flex-col bg-background font-sans">
        <CartSheet />
        <CartFloatingButton />
        <style dangerouslySetInnerHTML={{ __html: `
            :root {
                --site-primary: ${primaryColor};
                --site-secondary: ${secondaryColor};
                --primary: ${primaryHSL};
                --primary-foreground: 0 0% 100%;
                --ring: ${primaryHSL};
            }
            .dark {
                --site-primary: ${primaryColor};
                --site-secondary: ${secondaryColor};
                --primary: ${primaryHSL};
                --primary-foreground: 0 0% 100%;
                --ring: ${primaryHSL};
            }
        `}} />
        
        {/* SEO Structured Data (JSON-LD) */}
        <SiteStructuredData
          organization={config.organization}
          siteUrl={siteUrl}
          heroImage={config.heroImage}
        />
        
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-8">
                <Link href="/" className="flex items-center">
                    {config.logo ? (
                        <Image 
                            src={config.logo} 
                            alt={config.organization.name} 
                            width={40} 
                            height={40} 
                            className="object-contain h-10 w-auto" 
                        />
                    ) : (
                        <>
                            <Image 
                                src="/uplifter-logo.svg"
                                alt={config.organization.name} 
                                width={100} 
                                height={32} 
                                className="object-contain h-8 w-auto dark:hidden" 
                            />
                            <Image 
                                src="/uplifter-logo-dark.svg"
                                alt={config.organization.name} 
                                width={100} 
                                height={32} 
                                className="object-contain h-8 w-auto hidden dark:block" 
                            />
                        </>
                    )}
                </Link>
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                    <Link href="/" className="text-foreground/80 hover:text-primary transition-colors">Home</Link>
                    {config.showCalendar && <Link href="/calendar" className="text-foreground/80 hover:text-primary transition-colors">Calendar</Link>}
                    {config.showRegistration && <Link href="/register" className="text-foreground/80 hover:text-primary transition-colors">Register</Link>}
                    {config.showContact && <Link href="/contact" className="text-foreground/80 hover:text-primary transition-colors">Contact</Link>}
                </nav>
                <div className="flex items-center gap-3 text-sm">
                    <MarketingAnnouncementBell organizationId={config.organizationId} />
                    <ThemeToggle />
                    {session?.user ? (
                        <MarketingUserMenu
                            user={{
                                name: session.user.name || session.user.email || "User",
                                email: session.user.email || "",
                                image: session.user.image,
                            }}
                            isAdmin={isAdmin}
                            adminUrl={adminUrl}
                            athleteUrl={athleteUrl}
                            siteUrl={siteUrl}
                        />
                    ) : (
                        <>
                            <Link 
                                href="/signup" 
                                className="text-foreground/80 hover:text-primary transition-colors font-medium"
                            >
                                Sign Up
                            </Link>
                            <Button asChild size="sm" className="text-sm font-medium">
                                <Link href={loginUrl}>Login</Link>
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </header>
        <main className="flex-1">
            {children}
        </main>
        <footer className="border-t border-border/40 bg-muted/50 py-6">
             <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-8">
                <p className="text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} {config.organization.name}. All rights reserved.
                </p>
                <div className="flex items-center gap-4 flex-wrap justify-center">
                    {config.showContact && (
                        <Link 
                            href="/contact" 
                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                        >
                            Contact Us
                        </Link>
                    )}
                    {config.showRegistration && (
                        <Link 
                            href="/register" 
                            className="text-sm text-muted-foreground transition-colors hover:text-primary"
                        >
                            Register
                        </Link>
                    )}
                    <a 
                        href="https://www.uplifterinc.com/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                        Privacy
                    </a>
                    <a 
                        href="https://www.uplifterinc.com/terms-of-service"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                        Terms
                    </a>
                </div>
             </div>
             <div className="mx-auto mt-4 text-center">
                <a
                    href="https://www.uplifterinc.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                >
                    Powered by Uplifter
                </a>
             </div>
        </footer>
        <VisitorTracker organizationId={config.organizationId} />
        <CookieNotice />
    </div>
    </CartProvider>
    </QueueProvider>
    </ThemeProvider>
  );
}
