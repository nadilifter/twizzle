import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getAuthSession } from "@/lib/auth"

export default async function Home() {
  const session = await getAuthSession()
  const headersList = headers()
  const host = headersList.get("host") || ""
  
  // Check if we're on localhost:3000 (not uplifterinc.localhost)
  const isLocalhostOnly = host === "localhost:3000"
  
  if (session) {
    if (isLocalhostOnly) {
      // If on localhost:3000 with a session, redirect through bridge to ensure
      // proper session cookie is set on uplifterinc.localhost subdomains
      // This handles edge cases where OAuth completes but bridge redirect fails
      const bridgeUrl = new URL("/api/auth/oauth-bridge", "http://localhost:3000")
      bridgeUrl.searchParams.set("callbackUrl", "http://admin.uplifterinc.localhost:3000/")
      redirect(bridgeUrl.toString())
    } else {
      // Normal flow - redirect to dashboard (middleware handles subdomain routing)
      redirect("/dashboard")
    }
  } else {
    // No session - redirect to login portal
    // If on localhost:3000, redirect to login.uplifterinc.localhost for consistent login experience
    if (isLocalhostOnly) {
      redirect("http://login.uplifterinc.localhost:3000")
    }
    redirect("/login")
  }
}
