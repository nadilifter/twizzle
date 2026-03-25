/**
 * Determine whether a hex color is perceptually "light" using
 * the ITU-R BT.601 luma formula (same weights used in NTSC).
 * Returns true when white text would be hard to read on this color.
 */
export function isLightColor(hex: string): boolean {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * Returns a set of Tailwind class fragments for hero/banner sections
 * that sit on a background filled with the given primary color.
 * Light backgrounds get dark text; dark backgrounds get white text.
 */
export function getHeroContrastStyles(primaryColor: string) {
  const light = isLightColor(primaryColor);
  return {
    isLight: light,
    text: light ? "text-gray-900" : "text-white",
    textMuted: light ? "text-gray-900/70" : "text-white/80",
    textSubtle: light ? "text-gray-900/60" : "text-white/70",
    hoverText: light ? "hover:text-gray-900" : "hover:text-white",
    badge: light
      ? "bg-black/10 text-gray-900 backdrop-blur-sm border-black/20"
      : "bg-white/20 text-white backdrop-blur-sm border-white/20",
    patternFill: light ? "%23000000" : "%23ffffff",
    prose: light
      ? "prose prose-p:my-1 [&>p]:text-gray-900/80"
      : "prose prose-invert prose-p:my-1 [&>p]:text-white/80",
    secondaryFallback: light ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)",
  };
}
