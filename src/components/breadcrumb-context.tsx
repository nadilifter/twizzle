"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

type Overrides = Record<string, string>

interface BreadcrumbOverrideContextValue {
  overrides: Overrides
  setOverride: (path: string, label: string) => void
  removeOverride: (path: string) => void
}

const BreadcrumbOverrideContext = createContext<BreadcrumbOverrideContextValue>({
  overrides: {},
  setOverride: () => {},
  removeOverride: () => {},
})

export function BreadcrumbOverrideProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>({})

  const setOverride = useCallback((path: string, label: string) => {
    setOverrides((prev) => (prev[path] === label ? prev : { ...prev, [path]: label }))
  }, [])

  const removeOverride = useCallback((path: string) => {
    setOverrides((prev) => {
      if (!(path in prev)) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ overrides, setOverride, removeOverride }),
    [overrides, setOverride, removeOverride],
  )

  return (
    <BreadcrumbOverrideContext.Provider value={value}>
      {children}
    </BreadcrumbOverrideContext.Provider>
  )
}

export function useBreadcrumbOverrides() {
  return useContext(BreadcrumbOverrideContext)
}

/**
 * Sets a breadcrumb label override for a given path segment.
 * Automatically cleans up on unmount.
 */
export function useBreadcrumbOverride(path: string | undefined, label: string | undefined) {
  const { setOverride, removeOverride } = useBreadcrumbOverrides()
  const prevPathRef = useRef<string>()

  useEffect(() => {
    if (prevPathRef.current && prevPathRef.current !== path) {
      removeOverride(prevPathRef.current)
    }
    prevPathRef.current = path

    if (path && label) {
      setOverride(path, label)
    }

    return () => {
      if (path) removeOverride(path)
    }
  }, [path, label, setOverride, removeOverride])
}
