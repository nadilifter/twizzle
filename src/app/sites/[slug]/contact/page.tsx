import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Mail, Phone, MapPin } from "lucide-react";

const getCachedContactConfig = unstable_cache(
    async (subdomain: string) => {
        return db.websiteConfig.findUnique({
            where: { subdomain },
            include: { organization: true }
        });
    },
    ["site-config-contact"],
    { revalidate: 30 }
);

export default async function ContactPage({ params }: { params: { slug: string } }) {
    const subdomain = params.slug;

    const config = await getCachedContactConfig(subdomain);

    if (!config) return notFound();

    return (
        <div className="container mx-auto px-4 py-12 max-w-5xl">
            <h1 className="text-3xl font-bold mb-12 text-center">Contact {config.organization.name}</h1>
            
            <div className="grid md:grid-cols-2 gap-12">
                <div>
                    <h2 className="text-2xl font-semibold mb-6">Get in Touch</h2>
                    <p className="text-muted-foreground mb-8 text-lg">
                        Have questions about our programs or classes? We&apos;re here to help!
                        Reach out to us using the contact information below.
                    </p>

                    <div className="space-y-8">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                <Mail className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-medium text-lg mb-1">Email</h3>
                                <p className="text-muted-foreground">support@{subdomain}.uplifter.com</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                <Phone className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-medium text-lg mb-1">Phone</h3>
                                <p className="text-muted-foreground">(555) 123-4567</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                <MapPin className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-medium text-lg mb-1">Location</h3>
                                <p className="text-muted-foreground">
                                    123 Gym Street<br />
                                    Sports City, ST 12345
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card p-8 rounded-xl shadow-sm border border-border">
                    <h2 className="text-xl font-semibold mb-6">Send us a Message</h2>
                    <form className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium mb-1 text-foreground">Name</label>
                            <input 
                                type="text" 
                                id="name" 
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-muted-foreground"
                                placeholder="Your name"
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium mb-1 text-foreground">Email</label>
                            <input 
                                type="email" 
                                id="email" 
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-muted-foreground"
                                placeholder="your@email.com"
                            />
                        </div>
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium mb-1 text-foreground">Message</label>
                            <textarea 
                                id="message" 
                                rows={4}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-muted-foreground"
                                placeholder="How can we help you?"
                            ></textarea>
                        </div>
                        <button 
                            type="button" 
                            className="w-full bg-primary text-primary-foreground py-3 rounded-md hover:bg-primary/90 transition-colors font-medium"
                        >
                            Send Message
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
