import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Users, User, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { getHeroContrastStyles } from "@/lib/color-utils";

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

const getCachedTeamMembers = unstable_cache(
  async (organizationId: string) => {
    const highlights = await db.teamMemberHighlight.findMany({
      where: { organizationId, isVisible: true },
      include: {
        member: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
            programAssignments: {
              where: {
                program: { status: "ACTIVE" },
              },
              select: { programId: true },
            },
            memberCertifications: {
              where: {
                passed: true,
                certification: { isActive: true },
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              include: {
                certification: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    return highlights.map((h) => ({
      id: h.id,
      overrideImage: h.overrideImage,
      bio: h.bio,
      displayOrder: h.displayOrder,
      title: h.title || h.member.title,
      userId: h.member.user.id,
      name: h.member.user.name,
      avatar: h.member.user.avatar,
      programCount: h.member.programAssignments.length,
      certifications: h.member.memberCertifications.map((mc) => mc.certification.name),
    }));
  },
  ["site-team"],
  { revalidate: 30 }
);

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const config = await getCachedSiteConfig(params.slug);

  if (!config || !config.showTeam) return notFound();

  const primaryColor = config.primaryColor || "#000000";
  const hero = getHeroContrastStyles(primaryColor);
  const showCertifications = config.showTeamCertifications ?? false;
  const teamMembers = await getCachedTeamMembers(config.organizationId);
  // With 4+ staff, switch to a two-column grid on desktop so rows don't get visually thin and the page stays scannable.
  // Cards keep the same 3/4 image aspect ratio and show the full bio — just with reduced padding and typography.
  const twoColumn = teamMembers.length >= 4;

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
            <Users className="h-8 w-8" />
            <h1 className="text-4xl font-bold tracking-tight">Our Team</h1>
          </div>
          <p className={`text-lg ${hero.textMuted} max-w-2xl`}>
            {teamMembers.length > 1
              ? `Meet the ${teamMembers.length} dedicated professionals who make our programs exceptional.`
              : "Meet the dedicated professional behind our programs."}
          </p>
        </div>
      </section>

      {/* Team Member Sections */}
      <section className="mx-auto w-full max-w-6xl px-4 md:px-8 pt-16 pb-16">
        {teamMembers.length > 0 ? (
          <div
            className={twoColumn ? "grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10" : "space-y-16"}
          >
            {teamMembers.map((member, index) => {
              // Only alternate image side when rendered as wide single-column rows; in the two-column grid
              // all cards read left-to-right for visual consistency.
              const isReversed = !twoColumn && index % 2 === 1;
              const imageUrl = member.overrideImage || member.avatar;

              return (
                <article
                  key={member.id}
                  className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  <div
                    className={`grid ${
                      twoColumn ? "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "md:grid-cols-2"
                    } ${isReversed ? "md:[direction:rtl]" : ""}`}
                  >
                    {/* Image Panel */}
                    <div
                      className={`bg-muted flex items-start justify-center overflow-hidden ${
                        isReversed ? "[direction:ltr]" : ""
                      }`}
                    >
                      {imageUrl ? (
                        <div className="relative w-full aspect-[3/4]">
                          <ProgressiveImage
                            src={imageUrl}
                            alt={member.name}
                            fill
                            className="object-cover"
                            sizes={
                              twoColumn
                                ? "(max-width: 640px) 100vw, (max-width: 1024px) 40vw, 20vw"
                                : "(max-width: 768px) 100vw, 50vw"
                            }
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-full aspect-[3/4] text-muted-foreground/40">
                          <User className={twoColumn ? "h-16 w-16" : "h-24 w-24"} />
                        </div>
                      )}
                    </div>

                    {/* Info Panel */}
                    <div
                      className={`flex flex-col justify-start ${
                        twoColumn ? "p-5 md:p-6" : "p-6 md:p-8 lg:p-10"
                      } ${isReversed ? "[direction:ltr]" : ""}`}
                    >
                      <div className={twoColumn ? "mb-4" : "mb-5"}>
                        <p className="text-sm text-muted-foreground">{member.title}</p>
                        <h2
                          className={`font-bold tracking-tight ${
                            twoColumn ? "text-xl" : "text-2xl"
                          }`}
                        >
                          {member.name}
                        </h2>
                        {showCertifications && member.certifications.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {member.certifications.map((cert) => (
                              <span
                                key={cert}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: `${primaryColor}15`,
                                  color: primaryColor,
                                }}
                              >
                                {cert}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {member.bio && (
                        <p
                          className={`text-muted-foreground leading-relaxed whitespace-pre-line ${
                            twoColumn ? "mb-5 text-sm" : "mb-6"
                          }`}
                        >
                          {member.bio}
                        </p>
                      )}

                      {member.programCount > 0 && (
                        <div className="mt-auto">
                          <Link
                            href={`/register?coach=${member.userId}`}
                            className={`inline-flex items-center gap-2 rounded-lg font-medium ${
                              twoColumn ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
                            } ${hero.isLight ? "text-gray-900" : "text-white"} transition-colors hover:opacity-90`}
                            style={{ backgroundColor: primaryColor }}
                          >
                            View Programs
                            <ArrowRight className={twoColumn ? "h-3.5 w-3.5" : "h-4 w-4"} />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">
              No Team Members Available
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Team information is not available at this time. Please check back later.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
