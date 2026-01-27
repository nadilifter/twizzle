import React from "react";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { CartProvider } from "@/components/sites/cart-context";
import { CartSheet } from "@/components/sites/cart-sheet";
import { CartFloatingButton } from "@/components/sites/cart-floating-button";

export const dynamic = "force-dynamic";

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
                <Link href="/" className="flex items-center gap-3">
                    {config.logo ? (
                        <Image 
                            src={config.logo} 
                            alt={config.organization.name} 
                            width={50} 
                            height={43} 
                            className="object-contain" 
                        />
                    ) : null}
                    <div className="flex flex-col">
                        <span className="text-lg font-bold tracking-tight text-foreground">
                            {config.organization.name}
                        </span>
                        {config.heroSubheadline && (
                            <span className="text-xs font-medium text-muted-foreground hidden sm:block">
                                {config.heroSubheadline.length > 40 
                                    ? config.heroSubheadline.substring(0, 40) + '...' 
                                    : config.heroSubheadline}
                            </span>
                        )}
                    </div>
                </Link>
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                    <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">Home</Link>
                    {config.showCalendar && <Link href="/calendar" className="text-muted-foreground hover:text-primary transition-colors">Calendar</Link>}
                    {config.showRegistration && <Link href="/register" className="text-muted-foreground hover:text-primary transition-colors">Register</Link>}
                    {config.showContact && <Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</Link>}
                </nav>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    {config.showLogin && (
                        <Button asChild variant="ghost" size="sm">
                             <a href="/login">Coach Login</a>
                        </Button>
                    )}
                    {config.showRegistration && (
                        <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                            <Link href="/register">Join Now</Link>
                        </Button>
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
    </div>
    </CartProvider>
    </ThemeProvider>
  );
}
