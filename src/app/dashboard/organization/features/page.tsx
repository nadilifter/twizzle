"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { CheckCircle2, XCircle, Loader2, Shield, Save, RotateCcw, Info } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  type FeatureKey,
  type FeatureToggles,
} from "@/lib/feature-toggles"

interface SuperadminFeatureData {
  plan: { id: string; name: string } | null
  planDefaults: FeatureToggles | null
  overrides: Record<string, boolean> | null
  resolved: FeatureToggles
  lastUpdatedBy: string | null
  lastUpdatedAt: string | null
}

export default function OrganizationFeaturesPage() {
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false
  const organizationId = session?.user?.organizationId

  const [features, setFeatures] = React.useState<FeatureToggles | null>(null)
  const [superadminData, setSuperadminData] = React.useState<SuperadminFeatureData | null>(null)
  const [overrideToggles, setOverrideToggles] = React.useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  const fetchFeatures = React.useCallback(async () => {
    if (!organizationId) return

    try {
      if (isSuperAdmin) {
        const response = await fetch(`/api/superadmin/organizations/${organizationId}/features`)
        if (!response.ok) throw new Error("Failed to fetch")
        const data: SuperadminFeatureData = await response.json()
        setSuperadminData(data)
        setFeatures(data.resolved)
        setOverrideToggles(
          data.overrides && typeof data.overrides === "object" ? { ...data.overrides } : {}
        )
      } else {
        const response = await fetch("/api/organization/features")
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        setFeatures(data)
      }
    } catch (error) {
      console.error("Failed to load features:", error)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, isSuperAdmin])

  React.useEffect(() => {
    fetchFeatures()
  }, [fetchFeatures])

  const hasOverrideChanges = React.useMemo(() => {
    if (!superadminData) return false
    const original = superadminData.overrides ?? {}
    if (Object.keys(overrideToggles).length !== Object.keys(original).length) return true
    for (const [key, val] of Object.entries(overrideToggles)) {
      if ((original as Record<string, boolean>)[key] !== val) return true
    }
    return false
  }, [overrideToggles, superadminData])

  const handleToggleOverride = (key: FeatureKey, enabled: boolean) => {
    if (!superadminData) return
    const planDefault = superadminData.planDefaults?.[key] ?? false

    if (enabled === planDefault) {
      // Remove the override since it matches the plan default
      setOverrideToggles((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    } else {
      // Set the override to differ from plan default
      setOverrideToggles((prev) => ({ ...prev, [key]: enabled }))
    }
  }

  const handleSaveOverrides = async () => {
    if (!organizationId) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/superadmin/organizations/${organizationId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureToggles: overrideToggles }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to save")
      }
      toast.success("Feature overrides saved. Refreshing...")
      // Full refresh so sidebar, context, and all feature-gated UI updates
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message || "Failed to save feature overrides")
      setIsSaving(false)
    }
  }

  const handleResetOverrides = () => {
    if (!superadminData) return
    setOverrideToggles(
      superadminData.overrides && typeof superadminData.overrides === "object"
        ? { ...superadminData.overrides }
        : {}
    )
  }

  const getResolvedValue = (key: FeatureKey): boolean => {
    if (!superadminData) return features?.[key] ?? false
    const planDefault = superadminData.planDefaults?.[key] ?? false
    if (key in overrideToggles) return overrideToggles[key]
    return planDefault
  }

  const enabledCount = features
    ? FEATURE_KEYS.filter((k) => features[k]).length
    : 0

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Features</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin
              ? "Manage feature access for this organization. Toggle overrides beyond the plan defaults."
              : "View which features are available on your current plan"}
          </p>
        </div>
        {isSuperAdmin && superadminData?.plan && (
          <Badge variant="outline" className="text-xs">
            Plan: {superadminData.plan.name}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !features ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Unable to load feature information. Please try again later.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {enabledCount} of {FEATURE_KEYS.length} features enabled
              </span>
            </div>
            {isSuperAdmin && hasOverrideChanges && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetOverrides}
                  disabled={isSaving}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveOverrides}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save Overrides
                </Button>
              </div>
            )}
          </div>

          <TooltipProvider>
            <div className="grid gap-4 md:grid-cols-2">
              {FEATURE_KEYS.map((key) => {
                const resolvedEnabled = isSuperAdmin ? getResolvedValue(key) : features[key]
                const planDefault = superadminData?.planDefaults?.[key] ?? false
                const isOverridden = isSuperAdmin && key in overrideToggles

                return (
                  <Card
                    key={key}
                    className={!resolvedEnabled ? "opacity-60" : ""}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          {resolvedEnabled ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                          {FEATURE_LABELS[key]}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {isSuperAdmin && isOverridden && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Info className="h-3 w-3" />
                                  Override
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This feature has a superadmin override.</p>
                                <p className="text-xs text-muted-foreground">
                                  Plan default: {planDefault ? "Enabled" : "Disabled"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {isSuperAdmin ? (
                            <Switch
                              checked={resolvedEnabled}
                              onCheckedChange={(checked) => handleToggleOverride(key, checked)}
                              disabled={isSaving}
                            />
                          ) : (
                            <Badge variant={resolvedEnabled ? "default" : "secondary"}>
                              {resolvedEnabled ? "Enabled" : "Not included"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {FEATURE_DESCRIPTIONS[key]}
                      </p>
                      {isSuperAdmin && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Plan default: {planDefault ? "Enabled" : "Disabled"}
                          {isOverridden ? " (overridden)" : ""}
                        </p>
                      )}
                      {!isSuperAdmin && !resolvedEnabled && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Contact your administrator to upgrade your plan for access to this feature.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TooltipProvider>
        </>
      )}
    </div>
  )
}
