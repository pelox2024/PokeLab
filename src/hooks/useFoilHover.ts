import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Effet de survol "carte premium" : inclinaison 3D + reflet (glare) qui suit
 * le pointeur. On mute directement les variables CSS via ref (pas de re-render).
 * Désactivé si l'utilisateur préfère les animations réduites.
 */
export function useFoilHover<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = prefersReducedMotion();
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<T>) => {
      if (!enabled || reduce.current) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      el.style.setProperty("--rx", `${((0.5 - py) * 9).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((px - 0.5) * 11).toFixed(2)}deg`);
      el.style.setProperty("--foil-opacity", "1");
    },
    [enabled],
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--foil-opacity", "0");
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
