"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ServerPaginationProps {
  /** Current page index, 0-based. */
  pageIndex: number;
  /** Total number of pages. */
  pageCount: number;
  /** Called with the next 0-based page index. */
  onPageChange: (pageIndex: number) => void;
  /** Total row count, shown as "N results" when provided. */
  total?: number;
  /** Current page size; enables the "Rows per page" selector when paired with `onPageSizeChange`. */
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  /** Disable controls while a fetch is in flight. */
  isLoading?: boolean;
}

/**
 * Pagination control for server-paginated lists that don't use a TanStack
 * `DataTable` (custom card/row layouts). For table-based pages, use
 * `DataTable` with `manualPagination` instead.
 */
export function ServerPagination({
  pageIndex,
  pageCount,
  onPageChange,
  total,
  pageSize,
  pageSizeOptions = [10, 20, 25, 30, 50],
  onPageSizeChange,
  isLoading = false,
}: ServerPaginationProps) {
  const canPrevious = pageIndex > 0 && pageCount > 0;
  const canNext = pageIndex < pageCount - 1;
  const showPageSize = pageSize !== undefined && onPageSizeChange !== undefined;

  return (
    <div className="flex items-center justify-between px-2">
      {total !== undefined ? (
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {total} {total === 1 ? "result" : "results"}
        </div>
      ) : (
        <div className="hidden flex-1 lg:flex" />
      )}
      <div className="flex w-full items-center gap-6 lg:w-fit lg:gap-8">
        {showPageSize && (
          <div className="hidden items-center gap-2 lg:flex">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(0)}
            disabled={!canPrevious || isLoading}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={!canPrevious || isLoading}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!canNext || isLoading}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(pageCount - 1)}
            disabled={!canNext || isLoading}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
