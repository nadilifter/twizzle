"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  DEFAULT_FEATURE_TOGGLES,
  type FeatureKey,
  type FeatureToggles,
} from "@/lib/feature-toggles"

interface FeatureContextValue {
  features: FeatureToggles
  isLoaded: boolean
  isFeatureEnabled: (key: FeatureKey) => boolean
}

const FeatureContext = React.createContext<FeatureContextValue>({
  features: DEFAULT_FEATURE_TOGGLES,
  isLoaded: false,
  isFeatureEnabled: () => false,
})

// Module-level cache survives component remounts during client-side navigation
let featureCache: { orgId: string; data: FeatureToggles } | null = null

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  const organizationId = session?.user?.organizationId

  const cacheHit = !!organizationId && featureCache?.orgId === organizationId

  const [features, setFeatures] = React.useState<FeatureToggles>(
    () => cacheHit ? featureCache!.data : DEFAULT_FEATURE_TOGGLES
  )
  const [isLoaded, setIsLoaded] = React.useState(cacheHit)

  React.useEffect(() => {
    if (!organizationId) {
      if (!featureCache) {
        setFeatures(DEFAULT_FEATURE_TOGGLES)
        setIsLoaded(false)
      }
      return
    }

    if (featureCache?.orgId === organizationId) {
      setFeatures(featureCache.data)
      setIsLoaded(true)
      return
    }

    let cancelled = false

    const fetchFeatures = async () => {
      try {
        const response = await fetch("/api/organization/features")
        if (!response.ok) {
          console.error("Failed to fetch features:", response.statusText)
          return
        }
        const data = await response.json()
        if (!cancelled) {
          featureCache = { orgId: organizationId, data }
          setFeatures(data)
          setIsLoaded(true)
        }
      } catch (error) {
        console.error("Error fetching organization features:", error)
      }
    }

    fetchFeatures()

    return () => {
      cancelled = true
    }
  }, [organizationId])

  const isFeatureEnabled = React.useCallback(
    (key: FeatureKey) => features[key] ?? false,
    [features]
  )

  const value = React.useMemo(
    () => ({ features, isLoaded, isFeatureEnabled }),
    [features, isLoaded, isFeatureEnabled]
  )

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  )
}

export function useFeatures(): FeatureContextValue {
  return React.useContext(FeatureContext)
}
