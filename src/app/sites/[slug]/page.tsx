import React from "react";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function SitePage({ params }: { params: { slug: string } }) {
  const config = await db.websiteConfig.findUnique({
    where: { subdomain: params.slug },
  });

  if (!config) return notFound();

  return (
    <div className="flex flex-col">
       {/* Hero Section */}
       <section className="relative w-full h-[600px] flex items-center justify-center text-white overflow-hidden">
            {config.heroImage ? (
                <Image 
                    src={config.heroImage} 
                    alt="Hero" 
                    fill 
                    className="object-cover absolute inset-0 z-0 brightness-50"
                    priority
                />
            ) : (
                <div className="absolute inset-0 bg-slate-900 z-0" />
            )}
            
            <div className="relative z-10 container mx-auto px-4 text-center space-y-6">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                    {config.heroHeadline || "Welcome"}
                </h1>
                <p className="text-xl md:text-2xl text-slate-200 max-w-2xl mx-auto">
                    {config.heroSubheadline || ""}
                </p>
                {config.showRegistration && (
                    <Button asChild size="lg" className="text-lg px-8 py-6 rounded-full" style={{ backgroundColor: config.primaryColor || '#000', color: '#fff' }}>
                        <Link href={`/sites/${params.slug}/register`}>Get Started</Link>
                    </Button>
                )}
            </div>
       </section>

       {/* Introduction Text */}
       {config.heroText && (
         <section className="py-20 container mx-auto px-4">
             <div 
                className="prose prose-lg mx-auto" 
                dangerouslySetInnerHTML={{ __html: config.heroText }} 
             />
         </section>
       )}
    </div>
  );
}
