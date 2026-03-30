// Color mapping utilities for the calendar
// Maps hex colors to Tailwind color classes for consistent theming

import type React from "react";
import { cn } from "@/lib/utils";

// Predefined color palette that works with both light and dark modes
// Uses Tailwind's color system for consistent theming
const colorPalette = [
  {
    name: "blue",
    match: ["#3b82f6", "#2563eb", "#1d4ed8", "#60a5fa"],
    classes: {
      bg: "bg-blue-500/15 dark:bg-blue-400/20",
      bgSolid: "bg-blue-500 dark:bg-blue-400",
      border: "border-blue-500 dark:border-blue-400",
      text: "text-blue-600 dark:text-blue-400",
      hover: "hover:bg-blue-500/25 dark:hover:bg-blue-400/30",
    },
  },
  {
    name: "purple",
    match: ["#8b5cf6", "#7c3aed", "#6d28d9", "#a78bfa", "#8a3ffc", "#6929c4"],
    classes: {
      bg: "bg-purple-500/15 dark:bg-purple-400/20",
      bgSolid: "bg-purple-500 dark:bg-purple-400",
      border: "border-purple-500 dark:border-purple-400",
      text: "text-purple-600 dark:text-purple-400",
      hover: "hover:bg-purple-500/25 dark:hover:bg-purple-400/30",
    },
  },
  {
    name: "pink",
    match: ["#ec4899", "#db2777", "#be185d", "#f472b6"],
    classes: {
      bg: "bg-pink-500/15 dark:bg-pink-400/20",
      bgSolid: "bg-pink-500 dark:bg-pink-400",
      border: "border-pink-500 dark:border-pink-400",
      text: "text-pink-600 dark:text-pink-400",
      hover: "hover:bg-pink-500/25 dark:hover:bg-pink-400/30",
    },
  },
  {
    name: "red",
    match: ["#ef4444", "#dc2626", "#b91c1c", "#f87171"],
    classes: {
      bg: "bg-red-500/15 dark:bg-red-400/20",
      bgSolid: "bg-red-500 dark:bg-red-400",
      border: "border-red-500 dark:border-red-400",
      text: "text-red-600 dark:text-red-400",
      hover: "hover:bg-red-500/25 dark:hover:bg-red-400/30",
    },
  },
  {
    name: "orange",
    match: ["#f97316", "#ea580c", "#c2410c", "#fb923c"],
    classes: {
      bg: "bg-orange-500/15 dark:bg-orange-400/20",
      bgSolid: "bg-orange-500 dark:bg-orange-400",
      border: "border-orange-500 dark:border-orange-400",
      text: "text-orange-600 dark:text-orange-400",
      hover: "hover:bg-orange-500/25 dark:hover:bg-orange-400/30",
    },
  },
  {
    name: "amber",
    match: ["#f59e0b", "#d97706", "#b45309", "#fbbf24"],
    classes: {
      bg: "bg-amber-500/15 dark:bg-amber-400/20",
      bgSolid: "bg-amber-500 dark:bg-amber-400",
      border: "border-amber-500 dark:border-amber-400",
      text: "text-amber-600 dark:text-amber-400",
      hover: "hover:bg-amber-500/25 dark:hover:bg-amber-400/30",
    },
  },
  {
    name: "yellow",
    match: ["#eab308", "#ca8a04", "#a16207", "#facc15"],
    classes: {
      bg: "bg-yellow-500/15 dark:bg-yellow-400/20",
      bgSolid: "bg-yellow-500 dark:bg-yellow-400",
      border: "border-yellow-500 dark:border-yellow-400",
      text: "text-yellow-600 dark:text-yellow-400",
      hover: "hover:bg-yellow-500/25 dark:hover:bg-yellow-400/30",
    },
  },
  {
    name: "green",
    match: ["#22c55e", "#16a34a", "#15803d", "#4ade80"],
    classes: {
      bg: "bg-green-500/15 dark:bg-green-400/20",
      bgSolid: "bg-green-500 dark:bg-green-400",
      border: "border-green-500 dark:border-green-400",
      text: "text-green-600 dark:text-green-400",
      hover: "hover:bg-green-500/25 dark:hover:bg-green-400/30",
    },
  },
  {
    name: "emerald",
    match: ["#10b981", "#059669", "#047857", "#34d399"],
    classes: {
      bg: "bg-emerald-500/15 dark:bg-emerald-400/20",
      bgSolid: "bg-emerald-500 dark:bg-emerald-400",
      border: "border-emerald-500 dark:border-emerald-400",
      text: "text-emerald-600 dark:text-emerald-400",
      hover: "hover:bg-emerald-500/25 dark:hover:bg-emerald-400/30",
    },
  },
  {
    name: "teal",
    match: ["#14b8a6", "#0d9488", "#0f766e", "#2dd4bf"],
    classes: {
      bg: "bg-teal-500/15 dark:bg-teal-400/20",
      bgSolid: "bg-teal-500 dark:bg-teal-400",
      border: "border-teal-500 dark:border-teal-400",
      text: "text-teal-600 dark:text-teal-400",
      hover: "hover:bg-teal-500/25 dark:hover:bg-teal-400/30",
    },
  },
  {
    name: "cyan",
    match: ["#06b6d4", "#0891b2", "#0e7490", "#22d3ee", "#1192e8", "#0072c3"],
    classes: {
      bg: "bg-cyan-500/15 dark:bg-cyan-400/20",
      bgSolid: "bg-cyan-500 dark:bg-cyan-400",
      border: "border-cyan-500 dark:border-cyan-400",
      text: "text-cyan-600 dark:text-cyan-400",
      hover: "hover:bg-cyan-500/25 dark:hover:bg-cyan-400/30",
    },
  },
  {
    name: "sky",
    match: ["#0ea5e9", "#0284c7", "#0369a1", "#38bdf8"],
    classes: {
      bg: "bg-sky-500/15 dark:bg-sky-400/20",
      bgSolid: "bg-sky-500 dark:bg-sky-400",
      border: "border-sky-500 dark:border-sky-400",
      text: "text-sky-600 dark:text-sky-400",
      hover: "hover:bg-sky-500/25 dark:hover:bg-sky-400/30",
    },
  },
  {
    name: "indigo",
    match: ["#6366f1", "#4f46e5", "#4338ca", "#818cf8"],
    classes: {
      bg: "bg-indigo-500/15 dark:bg-indigo-400/20",
      bgSolid: "bg-indigo-500 dark:bg-indigo-400",
      border: "border-indigo-500 dark:border-indigo-400",
      text: "text-indigo-600 dark:text-indigo-400",
      hover: "hover:bg-indigo-500/25 dark:hover:bg-indigo-400/30",
    },
  },
  {
    name: "violet",
    match: ["#8b5cf6", "#7c3aed", "#6d28d9", "#a78bfa"],
    classes: {
      bg: "bg-violet-500/15 dark:bg-violet-400/20",
      bgSolid: "bg-violet-500 dark:bg-violet-400",
      border: "border-violet-500 dark:border-violet-400",
      text: "text-violet-600 dark:text-violet-400",
      hover: "hover:bg-violet-500/25 dark:hover:bg-violet-400/30",
    },
  },
  {
    name: "slate",
    match: ["#64748b", "#475569", "#334155", "#94a3b8"],
    classes: {
      bg: "bg-slate-500/15 dark:bg-slate-400/20",
      bgSolid: "bg-slate-500 dark:bg-slate-400",
      border: "border-slate-500 dark:border-slate-400",
      text: "text-slate-600 dark:text-slate-400",
      hover: "hover:bg-slate-500/25 dark:hover:bg-slate-400/30",
    },
  },
];

// Default fallback color (blue)
const defaultColor = colorPalette[0];

/**
 * Finds the closest color palette match for a given hex color
 */
function findColorMatch(hexColor: string): (typeof colorPalette)[0] {
  const normalizedHex = hexColor.toLowerCase();

  // First, try exact match
  for (const color of colorPalette) {
    if (color.match.some((m) => m.toLowerCase() === normalizedHex)) {
      return color;
    }
  }

  // If no exact match, find closest by hue
  const targetHsl = hexToHsl(normalizedHex);
  if (!targetHsl) return defaultColor;

  let closestColor = defaultColor;
  let closestDistance = Infinity;

  for (const color of colorPalette) {
    // Use the first match color as reference
    const refHsl = hexToHsl(color.match[0]);
    if (!refHsl) continue;

    // Calculate hue distance (accounting for circular nature)
    const hueDiff = Math.min(
      Math.abs(targetHsl.h - refHsl.h),
      360 - Math.abs(targetHsl.h - refHsl.h)
    );

    if (hueDiff < closestDistance) {
      closestDistance = hueDiff;
      closestColor = color;
    }
  }

  return closestColor;
}

/**
 * Converts hex color to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s, l };
}

/**
 * Get event color classes based on hex color
 */
export function getEventColorClasses(hexColor: string): {
  bg: string;
  bgSolid: string;
  border: string;
  text: string;
  hover: string;
  combined: string;
} {
  const color = findColorMatch(hexColor);
  return {
    ...color.classes,
    combined: cn(color.classes.bg, color.classes.border, color.classes.text, color.classes.hover),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getEventPillStyles(hexColor: string): React.CSSProperties {
  return {
    backgroundColor: hexToRgba(hexColor, 0.15),
    borderLeftColor: hexColor,
    color: hexColor,
  };
}

export function getEventPillClasses(_hexColor: string, isCancelled: boolean = false): string {
  return cn(
    "rounded px-1.5 py-0.5 text-xs font-medium transition-all",
    "border-l-3",
    "hover:brightness-95 dark:hover:brightness-110",
    isCancelled && "opacity-50 line-through"
  );
}

export function getEventCardStyles(hexColor: string): React.CSSProperties {
  return {
    borderLeftColor: hexColor,
  };
}

export function getEventCardClasses(_hexColor: string, isCancelled: boolean = false): string {
  return cn(
    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
    "border-l-4",
    "hover:bg-muted/50",
    isCancelled && "opacity-50"
  );
}

export function getBadgeStyles(hexColor: string): React.CSSProperties {
  return {
    color: hexColor,
    borderColor: hexColor,
  };
}

export function getBadgeColorClasses(_hexColor: string): string {
  return cn("text-xs shrink-0");
}
