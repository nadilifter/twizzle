"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface BreadcrumbOverride {
  label?: string;
  href?: string;
}

type Overrides = Record<string, BreadcrumbOverride>;

interface BreadcrumbOverrideContextValue {
  overrides: Overrides;
  setOverride: (path: string, override: BreadcrumbOverride) => void;
  removeOverride: (path: string) => void;
}

const BreadcrumbOverrideContext = createContext<BreadcrumbOverrideContextValue>({
  overrides: {},
  setOverride: () => {},
  removeOverride: () => {},
});

export function BreadcrumbOverrideProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>({});

  const setOverride = useCallback((path: string, override: BreadcrumbOverride) => {
    setOverrides((prev) => {
      const existing = prev[path];
      if (existing && existing.label === override.label && existing.href === override.href) {
        return prev;
      }
      return { ...prev, [path]: override };
    });
  }, []);

  const removeOverride = useCallback((path: string) => {
    setOverrides((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ overrides, setOverride, removeOverride }),
    [overrides, setOverride, removeOverride]
  );

  return (
    <BreadcrumbOverrideContext.Provider value={value}>
      {children}
    </BreadcrumbOverrideContext.Provider>
  );
}

export function useBreadcrumbOverrides() {
  return useContext(BreadcrumbOverrideContext);
}

/**
 * Sets a breadcrumb override for a given path segment. Pass `href` to redirect
 * that breadcrumb to a different URL (e.g. a tabbed parent page) instead of
 * the auto-generated path.
 */
export function useBreadcrumbOverride(
  path: string | undefined,
  label: string | undefined,
  href?: string
) {
  const { setOverride, removeOverride } = useBreadcrumbOverrides();
  const prevPathRef = useRef<string>();

  useEffect(() => {
    if (prevPathRef.current && prevPathRef.current !== path) {
      removeOverride(prevPathRef.current);
    }
    prevPathRef.current = path;

    if (path && (label !== undefined || href !== undefined)) {
      setOverride(path, { label, href });
    }

    return () => {
      if (path) removeOverride(path);
    };
  }, [path, label, href, setOverride, removeOverride]);
}
