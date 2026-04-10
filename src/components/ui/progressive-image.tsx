"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Drop-in replacement for next/image that loads a tiny placeholder first,
 * then cross-fades to the full-quality image. Uses Next.js image optimization
 * to fetch a ~300-byte, 32px-wide preview at quality=1 while the real image
 * loads in the background.
 *
 * Both images are always rendered (stacked via fill/absolute positioning).
 * The full image fades in over the placeholder, avoiding any flash. Inline
 * styles handle the opacity transition so consumer className transitions
 * (e.g. transition-transform for hover effects) are preserved.
 */
export function ProgressiveImage({
  className,
  quality = 100,
  onLoad,
  sizes,
  style,
  alt,
  ...props
}: ImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <>
      <Image
        {...props}
        alt={alt}
        sizes="32px"
        quality={1}
        className={cn(className, "blur-md")}
        style={style}
        aria-hidden="true"
      />
      <Image
        {...props}
        alt={alt}
        sizes={sizes}
        quality={quality}
        className={className}
        style={{
          ...(style && typeof style === "object" ? style : {}),
          opacity: isLoaded ? 1 : 0,
          transition: "opacity 700ms ease-in-out, transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onLoad={(e) => {
          setIsLoaded(true);
          if (typeof onLoad === "function") {
            (onLoad as (e: React.SyntheticEvent<HTMLImageElement>) => void)(e);
          }
        }}
      />
    </>
  );
}
