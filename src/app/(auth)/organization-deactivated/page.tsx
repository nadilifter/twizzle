"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { AlertTriangle, Mail, LogOut, CreditCard, RotateCcw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { logout } from "@/lib/logout"
import { getSubdomainUrl } from "@/lib/env-domains"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShineBorder } from "@/components/ui/shine-border"
import { UplifterLogo } from "@/components/uplifter-logo"

const SELF_SERVICE_REASONS = ["Non-payment", "Requested by customer"]

const SUPPORT_EMAIL = "support@uplifterinc.com"

export default function OrganizationDeactivatedPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <OrganizationDeactivatedContent />
    </Suspense>
  )
}

function OrganizationDeactivatedContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [isReactivating, setIsReactivating] = React.useState(false)

  const reason = searchParams.get("reason") || "Unknown"
  const orgName = searchParams.get("org") || "Your organization"
  const orgId = searchParams.get("orgId")
  const canSelfService = SELF_SERVICE_REASONS.includes(reason)
  const canReactivateOnline = reason === "Requested by customer" && !!orgId

  const handleSignOut = () => {
    logout("/login")
  }

  const handleReactivate = async () => {
    if (!orgId) return
    setIsReactivating(true)
    try {
      const response = await fetch("/api/organization/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to reactivate organization")
      }

      toast.success("Organization reactivated!")
      window.location.href = getSubdomainUrl("admin")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reactivate")
      setIsReactivating(false)
    }
  }

  return (
    <Card className="relative overflow-hidden w-full max-w-[480px]">
      <ShineBorder shineColor={["#ef4444", "#f97316"]} className="text-center" />
      <CardHeader className="items-center pb-2">
        <UplifterLogo width={180} height={36} className="h-9 mb-4" />
        <div className="flex items-center gap-2 text-destructive mb-2">
          <AlertTriangle className="h-6 w-6" />
          <h1 className="text-xl font-bold">Organization Deactivated</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong>{orgName}</strong> has been deactivated.
        </p>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
          <p>
            <span className="font-medium">Reason:</span> {reason}
          </p>
          <p className="text-muted-foreground">
            While deactivated, the admin dashboard, marketing site, and
            automated services for this organization are unavailable.
          </p>
        </div>

        {canReactivateOnline ? (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              You cancelled your plan. You can reactivate your organization
              to restore access to the dashboard and all services.
            </p>
            <Button className="w-full" onClick={handleReactivate} disabled={isReactivating}>
              {isReactivating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reactivate My Organization
            </Button>
          </div>
        ) : canSelfService ? (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              You may be able to restore your organization by updating your
              payment information.
            </p>
            <Button asChild className="w-full">
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Reactivate ${encodeURIComponent(orgName)}&body=I would like to reactivate my organization and update my payment details.`}>
                <CreditCard className="mr-2 h-4 w-4" />
                Contact Us to Reactivate
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Please contact support for assistance with your account.
            </p>
            <Button asChild className="w-full">
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Organization Deactivated - ${encodeURIComponent(orgName)}`}>
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </a>
            </Button>
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button variant="ghost" onClick={handleSignOut} className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </CardContent>
    </Card>
  )
}
