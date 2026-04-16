import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { MapPin, Clock, Phone, Mail, Building2 } from "lucide-react";
import { LocationMap } from "@/components/location-map";
import { getHeroContrastStyles } from "@/lib/color-utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const getCachedSiteConfig = unstable_cache(
  async (slug: string) => {
    return db.websiteConfig.findUnique({
      where: { subdomain: slug },
      include: { organization: true },
    });
  },
  ["site-config"],
  { revalidate: 30 }
);

const getCachedFacilities = unstable_cache(
  async (organizationId: string) => {
    const facilities = await db.facility.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: {
        operatingHours: {
          orderBy: [{ dayOfWeek: "asc" }, { openTime: "asc" }],
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return facilities.map((f) => ({
      id: f.id,
      name: f.name,
      street: f.street,
      city: f.city,
      stateProvince: f.stateProvince,
      postalCode: f.postalCode,
      country: f.country,
      latitude: f.latitude,
      longitude: f.longitude,
      phone: f.phone,
      email: f.email,
      description: f.description,
      maxCapacity: f.maxCapacity,
      squareFootage: f.squareFootage,
      isDefault: f.isDefault,
      operatingHours: f.operatingHours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime,
        closeTime: h.closeTime,
      })),
    }));
  },
  ["site-facilities"],
  { revalidate: 30 }
);

function formatTime(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${minute} ${ampm}`;
}

interface HoursSlot {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

function groupOperatingHours(hours: HoursSlot[]) {
  const byDay = new Map<number, { open: string; close: string }[]>();
  for (const h of hours) {
    const existing = byDay.get(h.dayOfWeek) || [];
    existing.push({ open: h.openTime, close: h.closeTime });
    byDay.set(h.dayOfWeek, existing);
  }

  const groups: { days: string; hours: string }[] = [];
  let i = 0;

  while (i < 7) {
    const slots = byDay.get(i);
    if (!slots || slots.length === 0) {
      let j = i + 1;
      while (j < 7 && (!byDay.get(j) || byDay.get(j)!.length === 0)) j++;

      const dayRange = j - i > 1 ? `${DAY_NAMES[i]} - ${DAY_NAMES[j - 1]}` : DAY_NAMES[i];
      groups.push({ days: dayRange, hours: "Closed" });
      i = j;
      continue;
    }

    const key = slots.map((s) => `${s.open}-${s.close}`).join(",");
    let j = i + 1;
    while (j < 7) {
      const nextSlots = byDay.get(j);
      if (!nextSlots || nextSlots.length === 0) break;
      const nextKey = nextSlots.map((s) => `${s.open}-${s.close}`).join(",");
      if (nextKey !== key) break;
      j++;
    }

    const dayRange = j - i > 1 ? `${DAY_NAMES[i]} - ${DAY_NAMES[j - 1]}` : DAY_NAMES[i];
    const timeStr = slots.map((s) => `${formatTime(s.open)} - ${formatTime(s.close)}`).join(", ");
    groups.push({ days: dayRange, hours: timeStr });
    i = j;
  }

  return groups;
}

function formatAddress(facility: {
  street: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
}) {
  const line1 = facility.street;
  const cityState = [
    facility.city,
    [facility.stateProvince, facility.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return { line1, cityState, country: facility.country };
}

export default async function FacilitiesPage({ params }: { params: { slug: string } }) {
  const config = await getCachedSiteConfig(params.slug);

  if (!config || !config.showLocations) return notFound();

  const primaryColor = config.primaryColor || "#000000";
  const hero = getHeroContrastStyles(primaryColor);
  const facilities = await getCachedFacilities(config.organizationId);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className={`relative py-16 ${hero.text}`}
        style={{
          background: `linear-gradient(to bottom right, ${primaryColor}, ${primaryColor}e6, ${primaryColor}cc)`,
        }}
      >
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="h-8 w-8" />
            <h1 className="text-4xl font-bold tracking-tight">Our Facilities</h1>
          </div>
          <p className={`text-lg ${hero.textMuted} max-w-2xl`}>
            {facilities.length > 1
              ? `Visit us at any of our ${facilities.length} facilities. We look forward to seeing you!`
              : "Come visit us! We look forward to seeing you."}
          </p>
        </div>
      </section>

      {/* Facility Sections */}
      <section className="mx-auto w-full max-w-6xl px-4 md:px-8 pt-16 pb-16">
        {facilities.length > 0 ? (
          <div className="space-y-16">
            {facilities.map((facility, index) => {
              const addr = formatAddress(facility);
              const hasCoords = facility.latitude != null && facility.longitude != null;
              const hoursGroups = groupOperatingHours(facility.operatingHours);
              const isReversed = index % 2 === 1;

              return (
                <article
                  key={facility.id}
                  className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  <div className={`grid md:grid-cols-2 ${isReversed ? "md:[direction:rtl]" : ""}`}>
                    {/* Map Panel */}
                    <div
                      className={`relative min-h-[280px] md:min-h-[360px] bg-muted ${
                        isReversed ? "[direction:ltr]" : ""
                      }`}
                    >
                      {hasCoords ? (
                        <LocationMap
                          latitude={facility.latitude!}
                          longitude={facility.longitude!}
                          label={facility.name}
                          sublabel={[facility.city, facility.stateProvince]
                            .filter(Boolean)
                            .join(", ")}
                          className="h-full min-h-[280px] md:min-h-[360px]"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground/40">
                          <div className="text-center">
                            <MapPin className="h-16 w-16 mx-auto mb-3" />
                            <p className="text-sm font-medium">Map unavailable</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info Panel */}
                    <div
                      className={`p-6 md:p-8 lg:p-10 flex flex-col justify-center ${
                        isReversed ? "[direction:ltr]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-5">
                        <div
                          className="p-2.5 rounded-lg shrink-0"
                          style={{ backgroundColor: `${primaryColor}15` }}
                        >
                          <Building2 className="h-5 w-5" style={{ color: primaryColor }} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold tracking-tight">{facility.name}</h2>
                          {facility.isDefault && (
                            <span
                              className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${primaryColor}15`,
                                color: primaryColor,
                              }}
                            >
                              Primary Location
                            </span>
                          )}
                        </div>
                      </div>

                      {facility.description && (
                        <p className="text-muted-foreground mb-5 leading-relaxed">
                          {facility.description}
                        </p>
                      )}

                      <div className="space-y-4">
                        {/* Address */}
                        {(addr.line1 || addr.cityState) && (
                          <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                            <div className="text-sm">
                              {addr.line1 && <p>{addr.line1}</p>}
                              {addr.cityState && <p>{addr.cityState}</p>}
                              {addr.country && (
                                <p className="text-muted-foreground">{addr.country}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Phone */}
                        {facility.phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <a
                              href={`tel:${facility.phone}`}
                              className="text-sm hover:text-primary transition-colors"
                            >
                              {facility.phone}
                            </a>
                          </div>
                        )}

                        {/* Email */}
                        {facility.email && (
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <a
                              href={`mailto:${facility.email}`}
                              className="text-sm hover:text-primary transition-colors"
                            >
                              {facility.email}
                            </a>
                          </div>
                        )}

                        {/* Operating Hours */}
                        {hoursGroups.length > 0 && facility.operatingHours.length > 0 && (
                          <div className="flex items-start gap-3 pt-1">
                            <Clock className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                            <div className="text-sm w-full">
                              <p className="font-medium mb-2">Hours</p>
                              <div className="space-y-1">
                                {hoursGroups.map((group, i) => (
                                  <div key={i} className="flex justify-between gap-4">
                                    <span className="text-muted-foreground whitespace-nowrap">
                                      {group.days}
                                    </span>
                                    <span
                                      className={`text-right whitespace-nowrap ${
                                        group.hours === "Closed" ? "text-muted-foreground/60" : ""
                                      }`}
                                    >
                                      {group.hours}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">
              No Facilities Available
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Location information is not available at this time. Please check back later.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
