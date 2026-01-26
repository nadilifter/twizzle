import React from "react";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

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
  const subdomain = params.slug;

  const config = await db.websiteConfig.findUnique({
    where: { subdomain: subdomain },
    include: { organization: true },
  });

  if (!config || !config.isPublished) {
    return notFound();
  }

  const primaryColor = config.primaryColor || "#000000";
  const secondaryColor = config.secondaryColor || "#ffffff";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
        <style dangerouslySetInnerHTML={{ __html: `
            :root {
                --primary: ${primaryColor};
                --secondary: ${secondaryColor};
            }
        `}} />
        
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between mx-auto px-4">
                <Link href={`/sites/${subdomain}`} className="flex items-center gap-2 font-bold text-xl">
                    {config.logo ? (
                        <div className="relative h-10 w-40">
                             <Image src={config.logo} alt={config.organization.name} fill className="object-contain object-left" />
                        </div>
                    ) : (
                        <span>{config.organization.name}</span>
                    )}
                </Link>
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                    <Link href={`/sites/${subdomain}`} className="hover:text-primary transition-colors">Home</Link>
                    {config.showCalendar && <Link href={`/sites/${subdomain}/calendar`} className="hover:text-primary transition-colors">Calendar</Link>}
                    {config.showRegistration && <Link href={`/sites/${subdomain}/register`} className="hover:text-primary transition-colors">Register</Link>}
                    {config.showContact && <Link href={`/sites/${subdomain}/contact`} className="hover:text-primary transition-colors">Contact</Link>}
                </nav>
                <div className="flex items-center gap-4">
                    {config.showLogin && (
                        <Button asChild variant="ghost" size="sm">
                             <a href="/login">Coach Login</a>
                        </Button>
                    )}
                    {config.showRegistration && (
                        <Button asChild size="sm" style={{ backgroundColor: primaryColor, color: '#fff' }}>
                            <Link href={`/sites/${subdomain}/register`}>Join Now</Link>
                        </Button>
                    )}
                </div>
            </div>
        </header>
        <main className="flex-1">
            {children}
        </main>
        <footer className="border-t bg-slate-100 py-6">
             <div className="container mx-auto px-4 flex flex-col items-center justify-between gap-4 md:flex-row">
                <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                    © {new Date().getFullYear()} {config.organization.name}. All rights reserved.
                </p>
             </div>
        </footer>
    </div>
  );
}
