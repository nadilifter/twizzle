import { db } from "@/lib/db"
import { FindYourClub } from "@/components/auth/find-your-club"

export const dynamic = "force-dynamic"

export default async function FindYourClubPage() {
  const [organizations, sports] = await Promise.all([
    db.organization.findMany({
      where: {
        isActive: true,
        websiteConfig: {
          isPublished: true,
          subdomain: { not: null },
        },
      },
      select: {
        id: true,
        name: true,
        logo: true,
        city: true,
        stateProvince: true,
        sports: {
          select: {
            sport: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        websiteConfig: {
          select: {
            subdomain: true,
            logo: true,
            heroLocation: true,
            primaryColor: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.sport.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { displayOrder: "asc" },
    }),
  ])

  return <FindYourClub organizations={organizations} sports={sports} />
}
