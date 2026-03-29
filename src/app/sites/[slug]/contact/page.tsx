import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Mail, Phone, MapPin } from "lucide-react";
import { LocationMap } from "@/components/location-map";
import { ContactForm } from "./contact-form";

const getCachedContactConfig = unstable_cache(
    async (subdomain: string) => {
        return db.websiteConfig.findUnique({
            where: { subdomain },
            include: {
                organization: {
                    include: {
                        facilities: {
                            where: { status: "ACTIVE", isDefault: true },
                            take: 1,
                            select: {
                                name: true,
                                street: true,
                                city: true,
                                stateProvince: true,
                                postalCode: true,
                                country: true,
                                phone: true,
                                email: true,
                                latitude: true,
                                longitude: true,
                            },
                        },
                    },
                },
            },
        });
    },
    ["site-config-contact"],
    { revalidate: 30 }
);

export default async function ContactPage({ params }: { params: { slug: string } }) {
    const subdomain = params.slug;

    const config = await getCachedContactConfig(subdomain);

    if (!config) return notFound();

    const org = config.organization;
    const facility = org.facilities[0] ?? null;

    const addressParts = facility
        ? [facility.street, facility.city, [facility.stateProvince, facility.postalCode].filter(Boolean).join(" "), facility.country].filter(Boolean)
        : [org.street, org.city, [org.stateProvince, org.postalCode].filter(Boolean).join(" "), org.country].filter(Boolean);

    const displayPhone = facility?.phone || org.phone;
    const displayEmail = facility?.email || org.email;
    const hasCoords = facility?.latitude != null && facility?.longitude != null;

    return (
        <div className="container mx-auto px-4 py-12 max-w-5xl">
            <h1 className="text-3xl font-bold mb-12 text-center">Contact {org.name}</h1>
            
            <div className="grid md:grid-cols-2 gap-12">
                <div>
                    <h2 className="text-2xl font-semibold mb-6">Get in Touch</h2>
                    <p className="text-muted-foreground mb-8 text-lg">
                        Have questions about our programs or classes? We&apos;re here to help!
                        Reach out to us using the contact information below.
                    </p>

                    <div className="space-y-8">
                        {displayEmail && (
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-lg mb-1">Email</h3>
                                    <p className="text-muted-foreground">{displayEmail}</p>
                                </div>
                            </div>
                        )}

                        {displayPhone && (
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Phone className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-lg mb-1">Phone</h3>
                                    <p className="text-muted-foreground">{displayPhone}</p>
                                </div>
                            </div>
                        )}

                        {addressParts.length > 0 && (
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-lg mb-1">Location</h3>
                                    <p className="text-muted-foreground">
                                        {addressParts.join(", ")}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {hasCoords && (
                        <div className="mt-8 rounded-lg overflow-hidden border border-border">
                            <LocationMap
                                latitude={facility!.latitude!}
                                longitude={facility!.longitude!}
                                label={facility?.name ?? org.name}
                                sublabel={addressParts.join(", ")}
                                className="h-56 min-h-0"
                            />
                        </div>
                    )}
                </div>

                <div className="bg-card p-8 rounded-xl shadow-sm border border-border">
                    <h2 className="text-xl font-semibold mb-6">Send us a Message</h2>
                    <ContactForm slug={subdomain} />
                </div>
            </div>
        </div>
    );
}
