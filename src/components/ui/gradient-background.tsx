import React from "react";
import { cn } from "@/lib/utils";

/**
 * A static gradient background with no animations.
 * Zero GPU overhead - pure CSS gradients only.
 */
export const GradientBackground = React.memo(({ className }: { className?: string }) => {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Base gradient layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10" />

      {/* Static gradient orbs for depth */}
      <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-indigo-500/15 via-indigo-500/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-purple-500/15 via-purple-500/5 to-transparent rounded-full blur-3xl" />

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                            linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Vignette effect */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/50" />
    </div>
  );
});

GradientBackground.displayName = "GradientBackground";
