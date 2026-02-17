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

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [features, setFeatures] = React.useState<FeatureToggles>(DEFAULT_FEATURE_TOGGLES)
  const [isLoaded, setIsLoaded] = React.useState(false)

  const organizationId = session?.user?.organizationId

  React.useEffect(() => {
    if (!organizationId) {
      setFeatures(DEFAULT_FEATURE_TOGGLES)
      setIsLoaded(false)
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
