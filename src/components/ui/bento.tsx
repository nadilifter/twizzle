import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type ColSpan = 1 | 2 | 3 | 4;
type RowSpan = 1 | 2 | 3;

const COL_CLASSES: Record<ColSpan, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
};

const ROW_CLASSES: Record<RowSpan, string> = {
  1: "md:row-span-1",
  2: "md:row-span-2",
  3: "md:row-span-3",
};

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Column count on md+ screens. Defaults to 4. */
  cols?: 2 | 3 | 4 | 6;
}

const COLS_CLASSES = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  6: "md:grid-cols-6",
} as const;

const BentoGrid = React.forwardRef<HTMLDivElement, BentoGridProps>(
  ({ className, cols = 4, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid grid-cols-1 gap-4 md:auto-rows-[10rem]", COLS_CLASSES[cols], className)}
      {...props}
    />
  )
);
BentoGrid.displayName = "BentoGrid";

interface BentoTileProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Column span on md+ screens. */
  colSpan?: ColSpan;
  /** Row span on md+ screens. */
  rowSpan?: RowSpan;
  /** Disable the hover lift (use for non-interactive tiles). */
  flat?: boolean;
  asChild?: boolean;
}

const BentoTile = React.forwardRef<HTMLDivElement, BentoTileProps>(
  ({ className, colSpan = 1, rowSpan = 1, flat = false, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(
          "rounded-xl border bg-card text-card-foreground shadow",
          "transition-[transform,box-shadow] duration-200",
          !flat && "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md",
          "flex flex-col overflow-hidden",
          COL_CLASSES[colSpan],
          ROW_CLASSES[rowSpan],
          className
        )}
        {...props}
      />
    );
  }
);
BentoTile.displayName = "BentoTile";

export { BentoGrid, BentoTile };
