"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface UplifterLogoProps {
  width?: number;
  height?: number;
  className?: string;
  variant?: "svg" | "png";
}

export function UplifterLogo({
  width = 120,
  height = 32,
  className,
  variant = "svg",
}: UplifterLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial hydration, show light logo (avoids flash)
  const isDark = mounted && resolvedTheme === "dark";

  const extension = variant === "png" ? "png" : "svg";
  const src = isDark ? `/uplifter-logo-dark.${extension}` : `/uplifter-logo.${extension}`;

  return (
    <Image
      src={src}
      alt="Twizzle"
      width={width}
      height={height}
      className={cn("w-auto", className)}
      priority
    />
  );
}
