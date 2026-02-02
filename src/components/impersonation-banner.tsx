"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Eye, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Banner displayed when a superadmin is viewing as a coach.
 * Shows who they're viewing as and provides a way to exit.
 */
export function ImpersonationBanner() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const [isExiting, setIsExiting] = useState(false)

  // Only show if currently impersonating
  const isImpersonating = !!(
    session?.user?.isSuperAdmin &&
    session?.user?.viewingAsCoachId &&
    session?.user?.viewingAsOrganizationId
  )

  if (!isImpersonating) {
    return null
  }

  const handleExit = async () => {
    setIsExiting(true)
    try {
      // Clear impersonation data from session
      await updateSession({
        viewingAsCoachId: "",
        viewingAsCoachName: "",
        viewingAsOrganizationId: "",
        viewingAsOrganizationName: "",
      })

      // Redirect back to superadmin portal
      router.push("/superadmin/view-as-coach")
    } catch (err) {
      console.error("Failed to exit impersonation:", err)
      setIsExiting(false)
    }
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Eye className="h-4 w-4" />
          <span>
            Viewing as <strong>{session.user.viewingAsCoachName}</strong>
            {" "}in <strong>{session.user.viewingAsOrganizationName}</strong>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          disabled={isExiting}
          className="text-amber-950 hover:text-amber-900 hover:bg-amber-400 h-7 px-2"
        >
          {isExiting ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Exiting...
            </>
          ) : (
            <>
              <X className="h-3 w-3 mr-1" />
              Exit View
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
