"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TwizzleWordmarkProps {
  /** Pixel height of the wordmark. Width is determined by the SVG viewBox.
   *  Default 36 to match the previous UplifterLogo size on the login page. */
  height?: number;
  className?: string;
}

/**
 * Plain text wordmark — "twizzle" rendered in the theme's primary purple.
 * Pure DOM/CSS, no image asset, so it scales crisply and inherits theme
 * changes automatically.
 *
 * Sized to match the previous UplifterLogo's bounding box at the login
 * page (width 180, height 36). The text fills that box via line-height
 * + font-size derived from `height`.
 */
export function TwizzleWordmark({ height = 36, className }: TwizzleWordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-bold tracking-tight text-primary select-none",
        className
      )}
      style={{
        fontSize: `${height}px`,
        lineHeight: 1,
        letterSpacing: "-0.04em",
      }}
    >
      twizzle
    </span>
  );
}
