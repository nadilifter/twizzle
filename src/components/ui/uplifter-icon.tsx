import React from "react";
import { cn } from "@/lib/utils";

interface UplifterIconProps {
  /** Pixel height of the icon. Width derived from the intrinsic ~1.32 aspect ratio. */
  height?: number;
  className?: string;
  /** Defaults to `currentColor` so the icon inherits the parent's text color. */
  color?: string;
}

/**
 * Icon-only version of the brand mark, extracted from
 * `/public/uplifter-logo.svg` (the two purple paths that form the balloon
 * head + body). Useful when you need the symbol on its own — paired with a
 * separate wordmark, or as a standalone icon.
 *
 * Renders in `currentColor` by default so the parent's text color flows
 * through (works in both light and dark themes).
 */
export function UplifterIcon({ height = 36, className, color }: UplifterIconProps) {
  return (
    <svg
      viewBox="20 15 186 141"
      height={height}
      width="auto"
      fill={color ?? "currentColor"}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("inline-block shrink-0", className)}
    >
      <path d="M143.859 48.8967C143.859 66.4996 130.135 80.7698 113.206 80.7698C96.2769 80.7698 82.5527 66.4996 82.5527 48.8967C82.5527 31.2934 96.2769 17.0232 113.206 17.0232C130.135 17.0232 143.859 31.2934 143.859 48.8967Z" />
      <path d="M173.119 128.58C156.399 144.539 138.286 153.209 113.206 153.209C88.1261 153.209 70.0132 144.539 53.2932 128.58C42.3891 118.172 37.1736 109.246 31.0001 95.2579C23.0525 77.2494 22.6499 51.08 22.6403 50.3603C22.6401 50.3382 22.6401 50.3326 22.6403 50.3109C22.6698 47.5157 26.2676 46.5067 27.6896 48.8959C54.7344 94.3331 74.5242 108.507 113.206 111.195C151.888 108.507 171.678 94.3331 198.723 48.8959C200.145 46.5067 203.743 47.5157 203.772 50.3109C203.772 50.3335 203.772 50.3377 203.772 50.3603C203.763 51.08 203.36 77.2494 195.412 95.2579C189.239 109.246 184.023 118.172 173.119 128.58Z" />
    </svg>
  );
}
