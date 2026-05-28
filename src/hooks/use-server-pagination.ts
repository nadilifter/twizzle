"use client";

import { useCallback, useState } from "react";

interface UseServerPaginationOptions {
  /** Initial 0-based page index. */
  initialPage?: number;
  /** Initial page size. */
  initialPageSize?: number;
}

export interface UseServerPaginationReturn {
  /** Current 0-based page index. */
  pageIndex: number;
  /** Current page size. */
  pageSize: number;
  /** Offset for the current page (`pageIndex * pageSize`). */
  offset: number;
  /**
   * Jump to a specific 0-based page. Clamped to be non-negative; the caller
   * (or the pagination control) is responsible for not exceeding the last page,
   * since this hook doesn't know the row total.
   */
  setPageIndex: (pageIndex: number) => void;
  /** Change the page size; resets to the first page. */
  setPageSize: (pageSize: number) => void;
  /** Reset back to the first page (e.g. when a search/filter changes). */
  reset: () => void;
}

/**
 * Local state for driving server-side pagination: tracks the current page and
 * page size and derives the query `offset`. Pair with `DataTable`'s
 * `manualPagination` mode or the standalone `ServerPagination` control.
 */
export function useServerPagination({
  initialPage = 0,
  initialPageSize = 20,
}: UseServerPaginationOptions = {}): UseServerPaginationReturn {
  const [pageIndex, setPageIndexState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  // Clamp to a non-negative index. The upper bound depends on the row total
  // (server-fetched), which this hook doesn't track — the ServerPagination
  // control and DataTable manual-mode guard keep callers within range.
  const setPageIndex = useCallback((index: number) => {
    setPageIndexState(Math.max(0, index));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageIndexState(0);
  }, []);

  const reset = useCallback(() => setPageIndexState(0), []);

  return {
    pageIndex,
    pageSize,
    offset: pageIndex * pageSize,
    setPageIndex,
    setPageSize,
    reset,
  };
}

/** Derive the total page count from a row total and page size. */
export function getPageCount(total: number, pageSize: number): number {
  return pageSize > 0 ? Math.ceil(total / pageSize) : 0;
}
