import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Explicit width, e.g. "w-32" Tailwind class or a CSS value via style */
  width?: string;
  /** Explicit height, e.g. "h-4" Tailwind class or a CSS value via style */
  height?: string;
  /** Override border-radius: "none" | "sm" | "md" | "lg" | "full". Defaults to "md". */
  rounded?: "none" | "sm" | "md" | "lg" | "full";
}

const roundedMap: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

function Skeleton({ className, width, height, rounded = "md", ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "skeleton-shimmer bg-primary/10",
        roundedMap[rounded],
        width,
        height,
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
