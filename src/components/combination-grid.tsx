"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AxisValueRestrictions {
  minAge?: number | null;
  maxAge?: number | null;
  allowedGenders?: string[];
}

interface AxisValue {
  id: string;
  name: string;
  restrictions?: AxisValueRestrictions;
}

interface CombinationEntry {
  rowId: string;
  colId: string;
  isActive: boolean;
}

interface CombinationGridProps {
  rows: AxisValue[];
  columns: AxisValue[];
  entries: CombinationEntry[];
  rowAxisLabel?: string;
  columnAxisLabel?: string;
  readOnly?: boolean;
  onToggleEntry?: (rowId: string, colId: string, isActive: boolean) => void;
}

function formatRestrictions(restrictions?: AxisValueRestrictions): string | null {
  if (!restrictions) return null;
  const parts: string[] = [];
  if (restrictions.minAge != null || restrictions.maxAge != null) {
    if (restrictions.minAge != null && restrictions.maxAge != null) {
      parts.push(`Ages ${restrictions.minAge}-${restrictions.maxAge}`);
    } else if (restrictions.minAge != null) {
      parts.push(`Ages ${restrictions.minAge}+`);
    } else {
      parts.push(`Ages up to ${restrictions.maxAge}`);
    }
  }
  if (restrictions.allowedGenders && restrictions.allowedGenders.length > 0) {
    parts.push(restrictions.allowedGenders.join(", "));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function CombinationGrid({
  rows,
  columns,
  entries,
  rowAxisLabel,
  columnAxisLabel,
  readOnly = false,
  onToggleEntry,
}: CombinationGridProps) {
  const entryMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    for (const entry of entries) {
      map.set(`${entry.rowId}:${entry.colId}`, entry.isActive);
    }
    return map;
  }, [entries]);

  const isActive = (rowId: string, colId: string): boolean => {
    return entryMap.get(`${rowId}:${colId}`) ?? true;
  };

  const activeCount = entries.filter((e) => e.isActive).length;
  const totalCount = rows.length * columns.length;

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        {rows.length === 0 && columns.length === 0
          ? "Add row and column values to see the combination grid."
          : rows.length === 0
            ? "Add row values to see the combination grid."
            : "Add column values to see the combination grid."}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {activeCount} of {totalCount} combinations active
          </span>
        </div>
        <ScrollArea className="w-full">
          <div className="min-w-fit">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background min-w-[120px]">
                    <span className="text-xs font-medium text-muted-foreground">
                      {rowAxisLabel || "Row"} / {columnAxisLabel || "Column"}
                    </span>
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead key={col.id} className="text-center min-w-[100px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center gap-1">
                            <Badge
                              variant="outline"
                              className="text-xs font-medium whitespace-nowrap"
                            >
                              {col.name}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        {col.restrictions && formatRestrictions(col.restrictions) && (
                          <TooltipContent>
                            <p>{formatRestrictions(col.restrictions)}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="sticky left-0 z-10 bg-background font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs whitespace-nowrap">
                              {row.name}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        {row.restrictions && formatRestrictions(row.restrictions) && (
                          <TooltipContent>
                            <p>{formatRestrictions(row.restrictions)}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TableCell>
                    {columns.map((col) => {
                      const active = isActive(row.id, col.id);
                      const label = `${row.name} - ${col.name}`;
                      return (
                        <TableCell
                          key={col.id}
                          className={cn("text-center", !active && "bg-muted/30")}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={active}
                                  disabled={readOnly}
                                  onCheckedChange={(checked) => {
                                    if (!readOnly && onToggleEntry) {
                                      onToggleEntry(row.id, col.id, !!checked);
                                    }
                                  }}
                                  aria-label={label}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className={cn(!active && "line-through text-muted-foreground")}>
                                {label}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
