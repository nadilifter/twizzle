"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/**
 * Handles organization switching when coming from superadmin.
 * This page must be on the admin subdomain so the session update
 * affects the correct cookie domain.
 */
export default function SwitchOrgPage() {
  return (
    <Suspense fallback={<SwitchOrgLoading />}>
      <SwitchOrgContent />
    </Suspense>
  )
}

function SwitchOrgLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="text-xl font-semibold">Loading...</h1>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    </div>
  )
}

function SwitchOrgContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, update } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  const orgId = searchParams.get("orgId")
  const orgName = searchParams.get("orgName")
  const redirect = searchParams.get("redirect")

  useEffect(() => {
    async function switchOrg() {
      if (!orgId || !orgName) {
        setError("Missing organization information")
        return
      }

      if (!session?.user) {
        // Wait for session to load
        return
      }

      if (switching) return
      setSwitching(true)

      try {
        // Update the session with the new organization
        await update({
          organizationId: orgId,
          organizationName: orgName,
        })

        // Navigate to redirect target or dashboard, and refresh to pick up new session
        router.push(redirect || "/dashboard")
        router.refresh()
      } catch (err) {
        console.error("Failed to switch organization:", err)
        setError("Failed to switch organization")
        setSwitching(false)
      }
    }

    if (session !== undefined) {
      switchOrg()
    }
  }, [session, orgId, orgName, update, switching, router])

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <h1 className="text-xl font-semibold text-destructive">Error</h1>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Go to Dashboard
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="text-xl font-semibold">Switching Organization</h1>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            Switching to {orgName || "organization"}...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
