"use client";
import { motion, useReducedMotion } from "framer-motion";

interface AnimatedCheckmarkProps {
  size?: number;
  className?: string;
}

export function AnimatedCheckmark({ size = 24, className }: AnimatedCheckmarkProps) {
  const shouldReduce = useReducedMotion();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <motion.path
        d="M20 6L9 17l-5-5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={
          shouldReduce
            ? { duration: 0 }
            : {
                pathLength: { duration: 0.4, ease: "easeInOut" },
                opacity: { duration: 0.1 },
              }
        }
      />
    </svg>
  );
}
