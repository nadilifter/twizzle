import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"

// Root POS layout - just handles authentication
// Organization-specific logic is in the (terminal) route group layout
export default async function POSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  
  if (!session) {
    // Middleware should handle this, but as a fallback
    redirect("/login?callbackUrl=/pos")
  }

  return <>{children}</>
}
