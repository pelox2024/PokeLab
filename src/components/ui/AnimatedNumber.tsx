import { useEffect, useRef, useState } from "react";

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  value: number;
  duration?: number;
  /** Formate la valeur affichée (par défaut : arrondi entier). */
  format?: (n: number) => string;
}

/**
 * Compteur animé : interpole en douceur (easeOutCubic, rAF) de la valeur
 * courante vers la nouvelle. Respecte prefers-reduced-motion.
 */
export function AnimatedNumber({ value, duration = 700, format }: Props) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
    const dur = prefersReduced() ? 0 : duration;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = dur <= 0 ? 1 : Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * eased;
      displayRef.current = cur;
      setDisplay(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{format ? format(display) : Math.round(display)}</>;
}
