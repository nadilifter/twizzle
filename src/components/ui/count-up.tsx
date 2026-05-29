"use client";
import { useEffect } from "react";
import { useMotionValue, useTransform, animate, motion, useReducedMotion } from "framer-motion";

interface CountUpProps {
  value: number;
  className?: string;
}

export function CountUp({ value, className }: CountUpProps) {
  const shouldReduce = useReducedMotion();
  const motionValue = useMotionValue(shouldReduce ? value : 0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));

  useEffect(() => {
    if (shouldReduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 1, ease: "easeOut" });
    return controls.stop;
  }, [value, motionValue, shouldReduce]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
