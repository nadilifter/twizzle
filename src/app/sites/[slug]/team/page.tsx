import { unstable_cache } from "next/cache"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Users, User, ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { getHeroContrastStyles } from "@/lib/color-utils"

const getCachedSiteConfig = unstable_cache(
  async (slug: string) => {
    return db.websiteConfig.findUnique({
      where: { subdomain: slug },
      include: { organization: true },
    })
  },
  ["site-config"],
  { revalidate: 30 }
)

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
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    })

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
    }))
  },
  ["site-team"],
  { revalidate: 30 }
)

export default async function TeamPage({
  params,
}: {
  params: { slug: string }
}) {
  const config = await getCachedSiteConfig(params.slug)

  if (!config || !config.showTeam) return notFound()

  const primaryColor = config.primaryColor || "#000000"
  const hero = getHeroContrastStyles(primaryColor)
  const teamMembers = await getCachedTeamMembers(config.organizationId)

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
          <div className="space-y-16">
            {teamMembers.map((member, index) => {
              const isReversed = index % 2 === 1
              const imageUrl = member.overrideImage || member.avatar

              return (
                <article
                  key={member.id}
                  className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  <div
                    className={`grid md:grid-cols-2 ${
                      isReversed ? "md:[direction:rtl]" : ""
                    }`}
                  >
                    {/* Image Panel */}
                    <div
                      className={`relative min-h-[280px] md:min-h-[360px] bg-muted ${
                        isReversed ? "[direction:ltr]" : ""
                      }`}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={member.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground/40">
                          <User className="h-24 w-24" />
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
                          <User
                            className="h-5 w-5"
                            style={{ color: primaryColor }}
                          />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold tracking-tight">
                            {member.name}
                          </h2>
                          <span
                            className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${primaryColor}15`,
                              color: primaryColor,
                            }}
                          >
                            {member.title}
                          </span>
                        </div>
                      </div>

                      {member.bio && (
                        <p className="text-muted-foreground mb-6 leading-relaxed">
                          {member.bio}
                        </p>
                      )}

                      {member.programCount > 0 && (
                        <div className="mt-auto">
                          <Link
                            href={`/register?coach=${member.userId}`}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${hero.isLight ? "text-gray-900" : "text-white"} transition-colors hover:opacity-90`}
                            style={{ backgroundColor: primaryColor }}
                          >
                            View Programs
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">
              No Team Members Available
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Team information is not available at this time. Please check back
              later.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
