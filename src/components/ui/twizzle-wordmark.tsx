"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { UplifterIcon } from "@/components/ui/uplifter-icon";

interface TwizzleWordmarkProps {
  /** Pixel height of the wordmark text. The icon is sized to match.
   *  Default 36 to match the previous UplifterLogo size on the login page. */
  height?: number;
  className?: string;
}

/**
 * Brand mark — the legacy purple Uplifter icon paired with the word
 * "Twizzle" rendered in the theme's primary purple. Pure DOM/CSS for the
 * text + inline SVG for the icon, so it scales crisply and inherits theme
 * changes automatically.
 *
 * Sized to match the previous UplifterLogo bounding box on the login
 * page (~height 36). The icon's intrinsic aspect ratio is ~1.32, so its
 * width at height=36 is ~48 px.
 */
export function TwizzleWordmark({ height = 36, className }: TwizzleWordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-bold tracking-tight text-primary select-none",
        className
      )}
    >
      <UplifterIcon height={height} />
      <span
        style={{
          fontSize: `${height}px`,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        Twizzle
      </span>
    </span>
  );
}
