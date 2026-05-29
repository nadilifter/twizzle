"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VideoBackgroundProps {
  /** Absolute path under /public (e.g. "/twizzle_login_background.mp4") */
  src: string;
  /** MIME type — defaults to "video/mp4". */
  type?: string;
  /** Optional className applied to the wrapper. */
  className?: string;
  /** Fade-in duration on mount, in ms. Default 2000. */
  fadeInMs?: number;
  /** Fade-out duration applied at the tail of each loop, in ms. Default 4000.
   *  Triggered via timeupdate vs. duration so the loop boundary doesn't pop. */
  loopFadeMs?: number;
}

/**
 * Full-bleed looping background video with a gentle fade-in on mount and a
 * fade-out → fade-in cycle at every loop boundary so the seam between loops
 * is invisible. Respects `prefers-reduced-motion`: if reduced-motion is set
 * the video still plays (it's content, not decoration) but the opacity
 * animations are skipped.
 *
 * Positioned `absolute inset-0` by default; the parent should set positioning
 * context. Pass `fixed inset-0` via `className` to anchor to the viewport.
 */
export function VideoBackground({
  src,
  type = "video/mp4",
  className,
  fadeInMs = 2000,
  loopFadeMs = 4000,
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    setMounted(true);
    // Drive the initial fade-in via state so React's re-render applies the
    // CSS transition cleanly (not a layout effect on the same frame).
    requestAnimationFrame(() => setOpacity(1));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let raf = 0;
    const FADE_WINDOW = loopFadeMs / 1000; // seconds before duration to start fading
    const tick = () => {
      const duration = video.duration;
      const current = video.currentTime;
      if (Number.isFinite(duration) && duration > 0) {
        // 1.0 most of the time, dips to ~0.2 in the last FADE_WINDOW seconds
        // and back up in the first FADE_WINDOW seconds after loop restart.
        const fromEnd = duration - current;
        const fromStart = current;
        const o = Math.min(fromEnd / FADE_WINDOW, fromStart / FADE_WINDOW, 1);
        setOpacity(0.2 + 0.8 * Math.max(0, Math.min(1, o)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loopFadeMs, mounted]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        style={{
          opacity,
          transition: `opacity ${fadeInMs}ms ease-out`,
        }}
        autoPlay
        muted
        loop
        playsInline
        // Older Safari needs the type attribute on a <source> child instead of
        // the video element directly.
      >
        <source src={src} type={type} />
      </video>
    </div>
  );
}
