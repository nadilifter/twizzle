import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isFeatureEnabled } from "@/lib/feature-resolver"
import { FeatureUnavailablePage } from "@/components/feature-unavailable-page"

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()

  if (!session?.user?.organizationId) {
    redirect("/login")
  }

  const storeEnabled = await isFeatureEnabled(session.user.organizationId, "store")
  if (!storeEnabled) {
    return <FeatureUnavailablePage feature="store" />
  }

  return <>{children}</>
}
