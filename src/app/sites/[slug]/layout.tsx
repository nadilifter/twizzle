import React from "react";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { CartProvider } from "@/components/sites/cart-context";
import { CartSheet } from "@/components/sites/cart-sheet";
import { CartFloatingButton } from "@/components/sites/cart-floating-button";
import { VisitorTracker } from "@/components/sites/visitor-tracker";
import { CookieNotice } from "@/components/sites/cookie-notice";

export const dynamic = "force-dynamic";

/**
 * Get the login URL for tenant sites.
 * Redirects to the centralized login portal with callback to return to the tenant site.
 */
function getLoginUrl(subdomain: string, host: string): string {
  const isLocal = host.includes("localhost");
  const protocol = isLocal ? "http" : "https";
  
  // Construct the callback URL to return to this tenant site after login
  const tenantHost = isLocal 
    ? `${subdomain}.uplifterinc.localhost:3000`
    : `${subdomain}.uplifterinc.com`;
  const callbackUrl = `${protocol}://${tenantHost}/`;
  
  // Construct the login URL
  const loginHost = isLocal 
    ? "login.uplifterinc.localhost:3000"
    : "login.uplifterinc.com";
  
  return `${protocol}://${loginHost}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
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

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const config = await db.websiteConfig.findUnique({
    where: { subdomain: params.slug },
    include: { organization: true },
  });
  if (!config) return {};
  return {
    title: config.organization.name,
    icons: {
      icon: config.favicon || "/favicon.ico",
    },
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

  // Get host for constructing login URL
  const headersList = headers();
  const host = headersList.get("host") || "";
  const loginUrl = getLoginUrl(subdomain, host);

  const primaryColor = config.primaryColor || "#000000";
  const secondaryColor = config.secondaryColor || "#ffffff";
  
  // Convert to HSL for Tailwind CSS variables
  const primaryHSL = hexToHSL(primaryColor);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
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
        
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-8">
                <Link href="/" className="flex items-center">
                    <Image 
                        src={config.logo || config.favicon || "/favicon.ico"} 
                        alt={config.organization.name} 
                        width={40} 
                        height={40} 
                        className="object-contain h-10 w-auto" 
                    />
                </Link>
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                    <Link href="/" className="text-foreground/80 hover:text-primary transition-colors">Home</Link>
                    {config.showCalendar && <Link href="/calendar" className="text-foreground/80 hover:text-primary transition-colors">Calendar</Link>}
                    {config.showRegistration && <Link href="/register" className="text-foreground/80 hover:text-primary transition-colors">Register</Link>}
                    {config.showContact && <Link href="/contact" className="text-foreground/80 hover:text-primary transition-colors">Contact</Link>}
                </nav>
                <div className="flex items-center gap-3 text-sm">
                    <ThemeToggle />
                    <Button asChild size="sm" className="text-sm font-medium">
                        <Link href={loginUrl}>Login</Link>
                    </Button>
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
                <div className="flex items-center gap-4">
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
                </div>
             </div>
        </footer>
        <VisitorTracker organizationId={config.organizationId} />
        <CookieNotice />
    </div>
    </CartProvider>
    </ThemeProvider>
  );
}
