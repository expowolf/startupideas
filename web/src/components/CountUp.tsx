"use client";
import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/** Counts up once on load (~0.6s). Respects prefers-reduced-motion. */
export function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!ref.current) return;
    if (reduce) {
      ref.current.textContent = format(value);
      return;
    }
    const c = animate(value * 0.97, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => ref.current && (ref.current.textContent = format(v)),
    });
    return () => c.stop();
  }, [value, format, reduce]);
  return <span ref={ref} className="num">{format(value)}</span>;
}
