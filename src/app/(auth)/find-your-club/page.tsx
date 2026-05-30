import { db } from "@/lib/db";
import { FindYourClub } from "@/components/auth/find-your-club";

export const dynamic = "force-dynamic";

export default async function FindYourClubPage() {
  const organizations = await db.organization.findMany({
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
  });

  return <FindYourClub organizations={organizations} />;
}
